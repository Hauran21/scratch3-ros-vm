const math = require('mathjs');
const JSON = require('circular-json');
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const Variable = require('../../engine/variable');
const ROSLIB = require('roslib');
const {Scratch3RosBase} = require('./RosUtil');
const icon = require('./icon');

class Scratch3RcjbotBlocks extends Scratch3RosBase {

    constructor(runtime, extensionId) {
        super('RCJBot', extensionId ? extensionId : 'rcjbot', runtime);
        this.imageSubscription = null;
        this.isImageVisible = false;
    }

    // customize to handle unadvertised topics
    moveForward ({SPEED}, util) {
        const TOPIC = "/cmd_velcmd_vel_sub_sub"
        let speed = Number(SPEED);
        if (!this._isJSON(speed)) speed = {data: speed};
        this.ros.publishTopic(TOPIC, speed).catch(err => {
            console.log(err);
            console.log("Advertising a new topic...");
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : this.ros.getRosType(speed.data),
            });
            rosTopic.publish(speed);
        }).catch(err => this._reportError(err));
    }

    ServiceMoveForward ({REQUEST}, util) {
        const SERVICE = "/cmd_vel_service";
        let req = this._getVariableValue(REQUEST, util.target) || this._tryParse(REQUEST);
        return this.ros.callService(SERVICE, req).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    // RCJBot specific services
    AlignService ({}, util) {
        return this.ros.callService("/scratch_push_action_align", {}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('AlignService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }

    DriveService ({FIELDS}, util) {
        const fields = Math.max(0, Math.floor(Number(FIELDS) || 0));
        if (fields === 0) return Promise.resolve(JSON.stringify({success: true}));

        const callOnce = () => this.ros.callService("/scratch_push_action_drive", {})
            .then(val => {
                if (val.success !== true) {
                    throw new Error('DriveService failed: success=false');
                }
                return val;
            });

        return Array.from({length: fields}).reduce(
            (p) => p.then(callOnce),
            Promise.resolve()
        ).then(val => JSON.stringify(val)).catch(err => this._reportError(err));
    }

    RotateLeftService ({}, util) {
        return this.ros.callService("/scratch_push_action_rotate", {data: true}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }

    RotateRightService ({}, util) {
        return this.ros.callService("/scratch_push_action_rotate", {data: false}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateRightService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }

    BlinkLeftService ({}, util) {
        return this.ros.callService("/scratch_push_action_blink", {data: true}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }
    
    BlinkRightService ({}, util) {
        return this.ros.callService("/scratch_push_action_blink", {data: false}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }

    DropLeftService ({}, util) {
        return this.ros.callService("/scratch_push_action_drop", {data: true}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }

    DropRightService ({}, util) {
        return this.ros.callService("/scratch_push_action_drop", {data: false}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => this._reportError(err));
    }
    
   
    ShowFrontDistance ({}) {
        const TOPIC = "/cmd_vel_pub";
        const that = this;
        return new Promise(resolve => {
            that.ros.getTopic(TOPIC).then(
                rosTopic => {
                    rosTopic.subscribe(msg => {
                        // rosTopic.unsubscribe();
                        if (rosTopic.messageType === 'std_msgs/String') {
                            msg.data = that._tryParse(msg.data, msg.data);
                        }
                        // Return the numeric value 
                        resolve(msg.data !== undefined ? msg.data : JSON.stringify(msg));
                    });
                }).catch(err => this._reportError(err));
        });
    }

    showRosImage({TOPIC}) {
        const that = this;
        let topicName = TOPIC;
        if (topicName && !topicName.startsWith('/')) topicName = `/${topicName}`;
        
        // Toggle behavior: if already visible, hide it
        if (this.isImageVisible) {
            this.hideRosImage();
            return Promise.resolve('Image hidden');
        }
        
        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                // Store subscription for cleanup
                that.imageSubscription = rosTopic;
                that.isImageVisible = true;
                
                rosTopic.subscribe(msg => {
                    try {
                        that._displayRosImage(msg);
                    } catch (err) {
                        reject(err);
                    }
                });
                resolve(`Image subscription started for ${topicName}`);
            }).catch(err => {
                reject(err);
            });
        });
    }

    hideRosImage() {
        // Unsubscribe from topic
        if (this.imageSubscription) {
            this.imageSubscription.unsubscribe();
            this.imageSubscription = null;
        }
        
        // Hide the canvas
        const canvas = document.getElementById('ros-image-display');
        if (canvas) {
            canvas.style.display = 'none';
        }
        
        this.isImageVisible = false;
        return 'Image hidden';
    }

    _displayRosImage(imageMsg) {
        const { width, height, encoding, data } = imageMsg;
        
        if (!width || !height || !data) {
            return;
        }
        
        // Create or get the canvas element for displaying the image
        let canvas = document.getElementById('ros-image-display');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'ros-image-display';
            canvas.style.position = 'fixed';
            canvas.style.top = '20px';
            canvas.style.right = '20px';
            canvas.style.border = '2px solid #333';
            canvas.style.zIndex = '1000';
            canvas.style.backgroundColor = 'white';
            canvas.style.maxWidth = '320px';
            canvas.style.maxHeight = '240px';
            canvas.style.borderRadius = '8px';
            canvas.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            document.body.appendChild(canvas);
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        // Convert ROS image data to canvas ImageData
        this._convertRosImageToImageData(data, width, height, imageData);
        
        ctx.putImageData(imageData, 0, 0);
        canvas.style.display = 'block';
    }

    _convertRosImageToImageData(rosData, width, height, imageData) {
        const pixels = imageData.data;
        
        let dataArray;
        
        // Handle different data formats
        if (typeof rosData === 'string') {
            const binaryString = atob(rosData);
            dataArray = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                dataArray[i] = binaryString.charCodeAt(i);
            }
        } else if (rosData instanceof ArrayBuffer) {
            dataArray = new Uint8Array(rosData);
        } else if (Array.isArray(rosData)) {
            dataArray = new Uint8Array(rosData);
        } else if (rosData instanceof Uint8Array) {
            dataArray = rosData;
        } else {
            dataArray = new Uint8Array(rosData);
        }
        
        // Convert RGB8 to RGBA for canvas
        for (let i = 0; i < width * height; i++) {
            if (i * 3 + 2 < dataArray.length) {
                pixels[i * 4] = dataArray[i * 3];     // R
                pixels[i * 4 + 1] = dataArray[i * 3 + 1]; // G
                pixels[i * 4 + 2] = dataArray[i * 3 + 2]; // B
                pixels[i * 4 + 3] = 255;                  // A
            }
        }
    }

    getInfo () {
        const topicArgs = {
            type: ArgumentType.STRING,
            defaultValue: ' /cmd_vel\ '
        };
        const serviceArgs = {
            type: ArgumentType.STRING,
            defaultValue: '{"data": true}'
        };
        const stringArgs = {
            type: ArgumentType.STRING,
            defaultValue: ' 50 '
        };


        // OG Args
        const stringArg = defValue => ({
            type: ArgumentType.STRING,
            defaultValue: defValue
        });
        const reporterMenu = opCode => ({
            acceptReporters: true,
            items: opCode
        });
        const variableArg = {
            type: ArgumentType.STRING,
            menu: 'variablesMenu',
            defaultValue: this._updateVariableList()[0].text
        };
        const listVariableArg = {
            type: ArgumentType.STRING,
            menu: 'listVariablesMenu',
            defaultValue: this._updateListVariableList()[0].text
        };
        const topicArg = {
            type: ArgumentType.STRING,
            menu: 'topicsMenu',
            defaultValue: this.topicNames[0]
        };
        const actionArg = {
            type: ArgumentType.STRING,
            menu: 'actionsMenu',
            defaultValue: this.actionNames[0]
        };
        const serviceArg = {
            type: ArgumentType.STRING,
            menu: 'servicesMenu',
            defaultValue: this.serviceNames[0]
        };
        const paramArg = {
            type: ArgumentType.STRING,
            menu: 'paramsMenu',
            defaultValue: this._updateParamList()[0].text
        };

        return {
            id: this.extensionId,
            name: this.extensionName,
            showStatusButton: true,

            menuIconURI: icon,

            blocks: [
                {
                    opcode: 'moveForward',
                    blockType: BlockType.COMMAND,
                    text: 'Move forward [SPEED]',
                    arguments: {
                        SPEED: stringArgs
                    }
                },
                {
                    opcode: 'ServiceMoveForward',
                    blockType: BlockType.COMMAND,
                    text: 'Service move forward',
                    arguments: {}
                },

                // RCJBot specific services
                {
                    opcode: 'AlignService',
                    blockType: BlockType.COMMAND,
                    text: 'Align Rcjbot',
                    arguments: {}
                },
                {
                    opcode: 'DriveService',
                    blockType: BlockType.COMMAND,
                    text: 'Drive Rcjbot forward [FIELDS] field',
                    arguments: {
                        FIELDS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'RotateLeftService',
                    blockType: BlockType.COMMAND,
                    text: 'LEFT TURN',
                    arguments: {}
                },
                {
                    opcode: 'RotateRightService',
                    blockType: BlockType.COMMAND,
                    text: 'RIGHT TURN',
                    arguments: {}
                },
                {
                    opcode: 'BlinkLeftService',
                    blockType: BlockType.COMMAND,
                    text: 'LEFT Blink',
                    arguments: {}
                },
                                {
                    opcode: 'BlinkRightService',
                    blockType: BlockType.COMMAND,
                    text: 'RIGHT Blink',
                    arguments: {}
                },
                {
                    opcode: 'DropLeftService',
                    blockType: BlockType.COMMAND,
                    text: 'LEFT Drop',
                    arguments: {}
                },
                {
                    opcode: 'DropRightService',
                    blockType: BlockType.COMMAND,
                    text: 'RIGHT Drop',
                    arguments: {}
                },
                {
                    opcode: 'ShowFrontDistance',
                    blockType: BlockType.REPORTER,
                    text: 'Front sensor distance',
                    arguments: {}
                },
                {
                    opcode: 'showRosImage',
                    blockType: BlockType.REPORTER,
                    text: 'Toggle ROS image from [TOPIC]',
                    arguments: {
                        TOPIC: {
                            type: ArgumentType.STRING,
                            defaultValue: '/left_camera/image_raw'
                        }
                    }
                },
            ],
            menus: {
                topicsMenu: reporterMenu('_updateTopicList'),
                actionsMenu: reporterMenu('_updateActionList'),
                servicesMenu: reporterMenu('_updateServiceList'),
                paramsMenu: reporterMenu('_updateParamList'),
                variablesMenu: '_updateVariableList',
                listVariablesMenu: '_updateListVariableList',
            }
        };
    }
}

module.exports = Scratch3RcjbotBlocks;
