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
            return Promise.resolve('Hidden');
        }
        
        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                // Store subscription for cleanup
                that.imageSubscription = rosTopic;
                that.isImageVisible = true;
                
                rosTopic.subscribe(msg => {
                    try {
                        that._displayRosImageInBlock(msg);
                    } catch (err) {
                        that._displayRosImageInBlock(msg);
                    }
                });
                
                resolve('Live');
            }).catch(err => {
                reject('No camera');
            });
        });
    }

    hideRosImage() {
        // Unsubscribe from topic
        if (this.imageSubscription) {
            this.imageSubscription.unsubscribe();
            this.imageSubscription = null;
        }
        
        // Hide the backdrop canvas
        const canvas = document.getElementById('ros-backdrop-image');
        if (canvas) {
            canvas.style.display = 'none';
        }
        
        this.isImageVisible = false;
        return 'Hidden';
    }

    _displayRosImageInBlock(imageMsg) {
        const { width, height, encoding, data } = imageMsg;
        
        if (!width || !height || !data) {
            return;
        }
        
        // Create or get the canvas element for displaying the backdrop-style image
        let canvas = document.getElementById('ros-backdrop-image');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'ros-backdrop-image';
            canvas.style.position = 'fixed';
            canvas.style.top = '120px';
            canvas.style.right = '40px';
            canvas.style.width = '400px';
            canvas.style.height = '300px';
            canvas.style.border = '2px solid #CCCCCC';
            canvas.style.borderRadius = '8px';
            canvas.style.backgroundColor = '#F9F9F9';
            canvas.style.zIndex = '999';
            canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            
            // Add title bar
            const titleBar = document.createElement('div');
            titleBar.style.position = 'absolute';
            titleBar.style.top = '-25px';
            titleBar.style.left = '0px';
            titleBar.style.right = '0px';
            titleBar.style.height = '20px';
            titleBar.style.backgroundColor = '#EEEEEE';
            titleBar.style.color = '#575E75';
            titleBar.style.textAlign = 'center';
            titleBar.style.lineHeight = '20px';
            titleBar.style.fontSize = '11px';
            titleBar.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
            titleBar.style.borderRadius = '6px 6px 0 0';
            titleBar.style.border = '2px solid #CCCCCC';
            titleBar.style.borderBottom = 'none';
            titleBar.textContent = 'Camera Feed';
            canvas.parentNode?.insertBefore(titleBar, canvas) || document.body.appendChild(titleBar);
            
            document.body.appendChild(canvas);
        }
        
        canvas.style.display = 'block';
        
        // Set canvas internal resolution
        canvas.width = 400;
        canvas.height = 300;
        
        // Create temporary canvas for image processing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        const tempCtx = tempCanvas.getContext('2d');
        const imageData = tempCtx.createImageData(width, height);
        
        // Convert ROS image data to canvas ImageData
        this._convertRosImageToImageData(data, width, height, imageData);
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw scaled image to backdrop canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio to maintain proportions
        const aspectRatio = width / height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        
        if (aspectRatio > canvas.width / canvas.height) {
            drawHeight = canvas.width / aspectRatio;
        } else {
            drawWidth = canvas.height * aspectRatio;
        }
        
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;
        
        ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);
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
                    text: 'camera [TOPIC]',
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
