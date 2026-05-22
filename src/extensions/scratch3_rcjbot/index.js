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

    AlignService ({}, util) {
        return this.ros.callService("/push_action_align", {}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('AlignService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => { this._reportError(err); throw err; });
    }

    DriveService ({FIELDS}, util) {
        const fields = Math.max(0, Math.floor(Number(FIELDS) || 0));
        if (fields === 0) return Promise.resolve(JSON.stringify({success: true}));

        const callOnce = () => this.ros.callService("/push_action_drive", {})
            .then(val => {
                if (val.success !== true) {
                    throw new Error('DriveService failed: success=false');
                }
                return val;
            });

        return Array.from({length: fields}).reduce(
            (p) => p.then(callOnce),
            Promise.resolve()
        ).then(val => JSON.stringify(val)).catch(err => { this._reportError(err); throw err; });
    }

    RotateLeftService ({}, util) {
        return this.ros.callService("/push_action_rotate", {data: true}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateLeftService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => { this._reportError(err); throw err; });
    }

    RotateRightService ({}, util) {
        return this.ros.callService("/push_action_rotate", {data: false}).
            then(val => {
                if (val.success !== true) {
                    throw new Error('RotateRightService failed: success=false');
                }
                return JSON.stringify(val);
            }).
            catch(err => { this._reportError(err); throw err; });
    }
    
    DriveForward ({VEL}, util) {
        const TOPIC = "/diff_drive_controller/cmd_vel";
        const velX = Number(VEL);
        const twistStamped = {
            header: {
                stamp: {sec: 0, nanosec: 0},
                frame_id: 'None'
            },
            twist: {
                linear: {x: Number.isFinite(velX) ? velX : 0.0, y: 0.0, z: 0.0},
                angular: {x: 0.0, y: 0.0, z: 0.0}
            }
        };

        return this.ros.publishTopic(TOPIC, twistStamped).catch(err => {
            console.log(err);
            console.log("Advertising a new topic...");
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : 'geometry_msgs/TwistStamped'
            });
            rosTopic.publish(twistStamped);
        }).catch(err => this._reportError(err));
    }

    Turn ({VEL}, util) {
        const TOPIC = "/diff_drive_controller/cmd_vel";
        const velZ = Number(VEL);
        const twistStamped = {
            header: {
                stamp: {sec: 0, nanosec: 0},
                frame_id: 'None'
            },
            twist: {
                linear: {x: 0.0, y: 0.0, z: 0.0},
                angular: {x: 0.0, y: 0.0, z: Number.isFinite(velZ) ? velZ : 0.0}
            }
        };

        return this.ros.publishTopic(TOPIC, twistStamped).catch(err => {
            console.log(err);
            console.log("Advertising a new topic...");
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : 'geometry_msgs/TwistStamped'
            });
            rosTopic.publish(twistStamped);
        }).catch(err => this._reportError(err));
    }

    

    BlinkLeftService ({}, util) {
        const payload = {
            cmd: 'turn',
            side: 0,
            color_on: [],
            color_off: [0, 0, 0, 0],
            duration_on: 0.5,
            duration_off: 0.5,
            repetitions: 8
        };

        return this.ros.callService('/camera_cmd', payload)
            .then(val => {
                return JSON.stringify(val);
            })
            .catch(err => { this._reportError(err); throw err; });
    }
    
    BlinkRightService ({}, util) {
        const payload = {
            cmd: 'turn',
            side: 1,
            color_on: [],
            color_off: [0, 0, 0, 0],
            duration_on: 0.5,
            duration_off: 0.5,
            repetitions: 8
        };

        return this.ros.callService('/camera_cmd', payload)
            .then(val => {
                return JSON.stringify(val);
            })
            .catch(err => { this._reportError(err); throw err; });
    }

    DropLeftService ({}, util) {
        const TOPIC = '/cmd_drop';
        const message = {data: -1};

        return this.ros.publishTopic(TOPIC, message).catch(err => {
            console.log(err);
            console.log('Advertising a new topic...');
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : 'std_msgs/Int8'
            });
            rosTopic.publish(message);
        }).catch(err => this._reportError(err));
    }

    DropRightService ({}, util) {
        const TOPIC = '/cmd_drop';
        const message = {data: 1};

        return this.ros.publishTopic(TOPIC, message).catch(err => {
            console.log(err);
            console.log('Advertising a new topic...');
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : 'std_msgs/Int8'
            });
            rosTopic.publish(message);
        }).catch(err => this._reportError(err));
    }

    ShowFrontDistance ({TOPIC}) {
        const that = this;
        let topicName = TOPIC;
        topicName = `/${topicName}_tof_scan`;

        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                const callback = (msg) => {
                    try {
                        // Handle LaserScan message type
                        if (rosTopic.messageType === 'sensor_msgs/LaserScan') {
                            // Get ranges[1] from LaserScan message
                            if (msg.ranges && msg.ranges.length > 1) {
                                const distance = msg.ranges[1];
                                // Return the float value, handle infinity/NaN
                                if (isNaN(distance) || !isFinite(distance)) {
                                    resolve(0.0);
                                } else {
                                    resolve(parseFloat(distance));
                                }
                            } else {
                                resolve(0.0);
                            }
                        } else if (rosTopic.messageType === 'std_msgs/String') {
                            msg.data = that._tryParse(msg.data, msg.data);
                            resolve(msg.data !== undefined ? msg.data : JSON.stringify(msg));
                        } else {
                            // For other message types, try to access ranges[1] if it exists
                            if (msg.ranges && msg.ranges.length > 1) {
                                const distance = msg.ranges[1];
                                if (isNaN(distance) || !isFinite(distance)) {
                                    resolve(0.0);
                                } else {
                                    resolve(parseFloat(distance));
                                }
                            } else {
                                resolve(msg.data !== undefined ? msg.data : JSON.stringify(msg));
                            }
                        }
                    } finally {
                        try { rosTopic.unsubscribe(callback); } catch (e) { try { rosTopic.unsubscribe(); } catch (e2) {} }
                    }
                };

                rosTopic.subscribe(callback);
            }).catch(err => { that._reportError(err); reject(err); });
        });
    }

    ShowAngle () {
        const that = this;
        const topicName = '/diff_drive_controller/odom';

        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                const callback = (msg) => {
                    try {
                        const angularZ = msg && msg.twist && msg.twist.twist && msg.twist.twist.angular
                            ? msg.twist.twist.angular.z
                            : 0.0;
                        const value = Number(angularZ);
                        resolve(Number.isFinite(value) ? value : 0.0);
                    } finally {
                        try { rosTopic.unsubscribe(callback); } catch (e) { try { rosTopic.unsubscribe(); } catch (e2) {} }
                    }
                };

                rosTopic.subscribe(callback);
            }).catch(err => { that._reportError(err); reject(err); });
        });
    }

    ShowBottomMarker () {
        const that = this;
        const topicName = '/marker/bottom';

        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                const callback = (msg) => {
                    try {
                        // If it's a std_msgs/String or has a data field, return the string (try parse if helper exists)
                        if (rosTopic.messageType === 'std_msgs/String' || (msg && typeof msg.data !== 'undefined')) {
                            const parsed = (that._tryParse && typeof that._tryParse === 'function')
                                ? that._tryParse(msg.data, msg.data)
                                : msg.data;
                            resolve(parsed !== undefined ? parsed : String(msg.data));
                        } else if (msg && typeof msg.data !== 'undefined') {
                            resolve(msg.data);
                        } else {
                            resolve(JSON.stringify(msg));
                        }
                    } finally {
                        try { rosTopic.unsubscribe(callback); } catch (e) { try { rosTopic.unsubscribe(); } catch (e2) {} }
                    }
                };

                rosTopic.subscribe(callback);
            }).catch(err => { that._reportError(err); reject(err); });
        });
    }
    
    showRosImage({TOPIC}) {
        const that = this;
        let topicName = TOPIC;
        if (topicName) topicName = `/${topicName}/image_raw`;
        
        // Toggle behavior: if already visible, hide it
        if (this.isImageVisible) {
            this.hideRosImage();
            return Promise.resolve('Hidden');
        }

        return new Promise((resolve, reject) => {
            that.ros.getTopic(topicName).then(rosTopic => {
                const callback = (msg) => {
                    try {
                        that._displayRosImageInBlock(msg);
                    } catch (err) {
                        // best-effort display
                        try { that._displayRosImageInBlock(msg); } catch (e) {}
                    }
                };

                rosTopic.subscribe(callback);
                that.imageSubscription = { rosTopic, callback };
                that.isImageVisible = true;
                resolve('Live');
            }).catch(err => { that._reportError(err); reject('No camera'); });
        });
    }

    hideRosImage() {
        // Unsubscribe from topic
        if (this.imageSubscription) {
            const { rosTopic, callback } = this.imageSubscription;
            try { rosTopic.unsubscribe(callback); } catch (e) { try { rosTopic.unsubscribe(); } catch (e2) {} }
            this.imageSubscription = null;
        }

        // Hide the container
        const container = document.getElementById('ros-backdrop-container');
        if (container) {
            container.style.display = 'none';
        }

        this.isImageVisible = false;
        return 'Hidden';
    }

    _displayRosImageInBlock(imageMsg) {
        const { width, height, encoding, data } = imageMsg;

        if (!width || !height || !data) return;

        // Create or get a container for title + canvas
        let container = document.getElementById('ros-backdrop-container');
        let canvas;
        if (!container) {
            container = document.createElement('div');
            container.id = 'ros-backdrop-container';
            container.style.position = 'fixed';
            container.style.top = '120px';
            container.style.right = '40px';
            container.style.width = '400px';
            container.style.zIndex = '999';
            container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';

            const titleBar = document.createElement('div');
            titleBar.id = 'ros-backdrop-title';
            titleBar.style.height = '24px';
            titleBar.style.backgroundColor = '#EEEEEE';
            titleBar.style.color = '#575E75';
            titleBar.style.textAlign = 'center';
            titleBar.style.lineHeight = '24px';
            titleBar.style.fontSize = '12px';
            titleBar.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
            titleBar.style.border = '2px solid #CCCCCC';
            titleBar.style.borderBottom = 'none';
            titleBar.style.borderRadius = '6px 6px 0 0';
            titleBar.textContent = 'Camera Feed';
            container.appendChild(titleBar);

            canvas = document.createElement('canvas');
            canvas.id = 'ros-backdrop-image';
            canvas.style.width = '400px';
            canvas.style.height = '300px';
            canvas.style.border = '2px solid #CCCCCC';
            canvas.style.borderRadius = '0 0 6px 6px';
            canvas.style.backgroundColor = '#F9F9F9';
            container.appendChild(canvas);

            document.body.appendChild(container);
        } else {
            canvas = container.querySelector('#ros-backdrop-image');
            container.style.display = 'block';
        }

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
        this._convertRosImageToImageData(data, width, height, imageData, encoding);
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

    Wait ({TIME}, util) {
        const t = Number(TIME) || 0;
        // Return a Promise that resolves after t seconds
        return new Promise(resolve => setTimeout(resolve, Math.max(0, t) * 1000));
    }

    _convertRosImageToImageData(rosData, width, height, imageData, encoding) {
        const pixels = imageData.data;

        let dataArray;

        // atob/polyfill: prefer browser atob, fall back to Buffer if available
        const _atob = (typeof window !== 'undefined' && typeof window.atob === 'function')
            ? window.atob
            : (typeof globalThis !== 'undefined' && globalThis.Buffer)
                ? (str => globalThis.Buffer.from(str, 'base64').toString('binary'))
                : null;

        // Handle different data formats
        if (typeof rosData === 'string') {
            if (!_atob) {
                // Cannot decode base64 string in this environment
                dataArray = new Uint8Array(0);
            } else {
                const binaryString = _atob(rosData);
                dataArray = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    dataArray[i] = binaryString.charCodeAt(i);
                }
            }
        } else if (rosData instanceof ArrayBuffer) {
            dataArray = new Uint8Array(rosData);
        } else if (Array.isArray(rosData)) {
            dataArray = new Uint8Array(rosData);
        } else if (rosData instanceof Uint8Array) {
            dataArray = rosData;
        } else {
            try {
                dataArray = new Uint8Array(rosData);
            } catch (e) {
                dataArray = new Uint8Array(0);
            }
        }

        // Interpret encoding
        const enc = (encoding || '').toString().toLowerCase();

        if (enc.includes('bgr')) {
            for (let i = 0; i < width * height; i++) {
                const base = i * 3;
                if (base + 2 < dataArray.length) {
                    pixels[i * 4] = dataArray[base + 2];     // R
                    pixels[i * 4 + 1] = dataArray[base + 1]; // G
                    pixels[i * 4 + 2] = dataArray[base];     // B
                    pixels[i * 4 + 3] = 255;
                } else {
                    pixels[i * 4] = 0; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 0; pixels[i * 4 + 3] = 255;
                }
            }
        } else if (enc.includes('mono')) {
            for (let i = 0; i < width * height; i++) {
                const v = dataArray[i] || 0;
                pixels[i * 4] = v; pixels[i * 4 + 1] = v; pixels[i * 4 + 2] = v; pixels[i * 4 + 3] = 255;
            }
        } else {
            // default: assume RGB8
            for (let i = 0; i < width * height; i++) {
                const base = i * 3;
                if (base + 2 < dataArray.length) {
                    pixels[i * 4] = dataArray[base];     // R
                    pixels[i * 4 + 1] = dataArray[base + 1]; // G
                    pixels[i * 4 + 2] = dataArray[base + 2]; // B
                    pixels[i * 4 + 3] = 255;
                } else {
                    pixels[i * 4] = 0; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 0; pixels[i * 4 + 3] = 255;
                }
            }
        }
    }

    getInfo () {
        return {
            id: this.extensionId,
            name: this.extensionName,
            showStatusButton: true,

            menuIconURI: icon,

            blocks: [
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
                    opcode: 'DriveForward',
                    blockType: BlockType.COMMAND,
                    text: 'DRIVE [VEL]',
                    arguments: {
                        VEL: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0.3'
                        }
                    }
                },
                {
                    opcode: 'Turn',
                    blockType: BlockType.COMMAND,
                    text: 'TURN [VEL]',
                    arguments: {
                        VEL: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0.3'
                        }
                    }
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
                    text: '[TOPIC] distance sensor',
                    arguments: {
                        TOPIC: {
                            type: ArgumentType.STRING,
                            defaultValue: 'front_left'
                        }
                    }
                },
                {
                    opcode: 'ShowAngle',
                    blockType: BlockType.REPORTER,
                    text: 'Robot Angle',
                    arguments: {}
                },
                {
                    opcode: 'ShowBottomMarker',
                    blockType: BlockType.REPORTER,
                    text: 'Bottom Marker',
                    arguments: {}
                },
                {
                    opcode: 'Wait',
                    blockType: BlockType.COMMAND,
                    text: 'Wait [TIME]',
                    arguments: {
                        TIME: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1.0'
                        }
                    }
                },
                {
                    opcode: 'showRosImage', 
                    blockType: BlockType.REPORTER,
                    text: 'camera [TOPIC]',
                    arguments: {
                        TOPIC: {
                            type: ArgumentType.STRING,
                            defaultValue: 'left_camera'
                        }
                    }
                },
            ]
        };
    }
}

module.exports = Scratch3RcjbotBlocks;
