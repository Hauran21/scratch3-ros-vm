const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Scratch3RobotBase = require('../scratch3_ros/RobotUtil');
const icon = require('./icon');

var Scratch3SpotRobotFirstConnect = true;

class Scratch3SpotRobotBlocks extends Scratch3RobotBase {

    constructor(runtime, extensionId) {
        super('Spot', extensionId ? extensionId : 'spotRobot',
              '/robotsound', '/robotsound_jp', runtime,
              'belka', Scratch3SpotRobotFirstConnect);
        Scratch3SpotRobotFirstConnect = false;
        this.icon = icon;
    }

    _makeGoal (pose, secs) {
        const header = {frame_id: 'body'};
        const msg = {
            header: header,
            goal: {
                target_pose: {
                    header: header,
                    pose: pose
                },
                duration: {
                    data: {
                        secs: secs,
                        nsecs: 0
                    }
                }
            }
        }
        return msg;
    }

    _makeQuaternion (x, y, z) {
        const q = {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            w: 1.0,
        }
        return q;
    }

    claim ({MODE}) {
        let serviceName;
        if (MODE === 'claim') {
            serviceName = '/spot/claim';
        }
        if (MODE === 'release') {
            serviceName = '/spot/release';
        }

        return this.ros.callService(serviceName, {}).
            catch(err => this._reportError(err));
    }

    power ({MODE}) {
        let serviceName;
        if (MODE === 'on') {
            serviceName = '/spot/power_on';
        }
        if (MODE === 'off') {
            serviceName = '/spot/power_off';
        }

        return this.ros.callService(serviceName, {}).
            catch(err => this._reportError(err));
    }

    act ({ACTION}) {
        let serviceName;
        if (ACTION === 'stand') {
            serviceName = '/spot/stand';
        }
        if (ACTION === 'sit') {
            serviceName = '/spot/sit';
        }

        return this.ros.callService(serviceName, {}).
            catch(err => this._reportError(err));
    }

    dock ({ACTION}) {
        let serviceName;
        let req = {};
        if (ACTION === 'in') {
            serviceName = '/spot/dock';
            req = {dock_id: 521};
        }
        if (ACTION === 'out') {
            serviceName = '/spot/undock';
        }

        return this.ros.callService(serviceName, {}).
            catch(err => this._reportError(err));
    }

    moveForward ({X, TIME}) {
        const pose = {
            position:  {x: X,  y: 0.0, z: 0.0}, 
            orientation:  {x: 0, y: 0, z: 0.707107, w: 0.707107}
        };
        const msg = this._makeGoal(pose, TIME);
        this.ros.publishTopic('/spot/trajectory/goal', msg);
        return this._waitMessage('/spot/trajectory/result').
            catch(err => this._reportError(err));
    }

    moveRotate ({THETA, TIME}) {
        const orientation = this._makeQuaternion(0.0, 0.0, THETA);
        const pose = {
            position:  {x: 0.0,  y: 0.0, z: 0.0}, 
            orientation:  orientation
        };
        const msg = this._makeGoal(pose, TIME);

        this.ros.publishTopic('/spot/trajectory/goal', msg);
        return this._waitMessage('/spot/trajectory/result').
            catch(err => this._reportError(err));
    }

    move3D ({X, Y, THETA, TIME}) {
        const orientation = this._makeQuaternion(0.0, 0.0, THETA);
        const pose = {
            position:  {x: X,  y: Y, z: 0.0}, 
            orientation:  orientation
        };
        const msg = this._makeGoal(pose, TIME);

        this.ros.publishTopic('/spot/trajectory/goal', msg);
        return this._waitMessage('/spot/trajectory/result').
            catch(err => this._reportError(err));
    }

    bodyPose ({X, Y}) {
        const orientation = this._makeQuaternion(X, Y, 0.0);
        const msg = {
            position:  {x: 0.0,  y: 0.0, z: 0.0}, 
            orientation:  orientation
        };

        this.ros.publishTopic('/spot/body_pose', msg).
            catch(err => this._reportError(err));
    }

    getInfo () {
        return {
            id: this.extensionId,
            name: this.extensionName,
            showStatusButton: true,

            color1: this._randomizedColor(0x8ED154),
            menuIconURI: this.icon,
            
            blocks: [
                {
                    opcode: 'query',
                    blockType: BlockType.BOOLEAN,
                    text: 'query [TEXT]',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Proceed?'
                        }
                    }
                },
                {
                    opcode: 'playSound',
                    blockType: BlockType.COMMAND,
                    text: 'play sound [SOUND] wait: [WAIT]',
                    arguments: {
                        SOUND: {
                            type: ArgumentType.STRING,
                            menu: 'soundMenu',
                            defaultValue: '1'
                        },
                        WAIT: {
                            type: ArgumentType.BOOLEAN,
                            menu: 'booleanMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                {
                    opcode: 'speakText',
                    blockType: BlockType.COMMAND,
                    text: 'speak [TEXT] wait: [WAIT]',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Hello!'
                        },
                        WAIT: {
                            type: ArgumentType.BOOLEAN,
                            menu: 'booleanMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                {
                    opcode: 'speakTextJp',
                    blockType: BlockType.COMMAND,
                    text: 'speak-jp [TEXT] wait: [WAIT]',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: 'こんにちは!'
                        },
                        WAIT: {
                            type: ArgumentType.BOOLEAN,
                            menu: 'booleanMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                '---',
                {
                    opcode: 'claim',
                    blockType: BlockType.COMMAND,
                    text: '[MODE] robot',
                    arguments: {
                        MODE: {
                            type: ArgumentType.STRING,
                            menu: 'claimMenu',
                            defaultValue: 'claim'
                        }
                    }
                },
                {
                    opcode: 'power',
                    blockType: BlockType.COMMAND,
                    text: 'power [MODE]',
                    arguments: {
                        MODE: {
                            type: ArgumentType.STRING,
                            menu: 'powerMenu',
                            defaultValue: 'on'
                        }
                    }
                },
                {
                    opcode: 'act',
                    blockType: BlockType.COMMAND,
                    text: 'make robot [ACTION]',
                    arguments: {
                        ACTION: {
                            type: ArgumentType.STRING,
                            menu: 'actionMenu',
                            defaultValue: 'stand'
                        }
                    }
                },
                {
                    opcode: 'dock',
                    blockType: BlockType.COMMAND,
                    text: 'dock [ACTION]',
                    arguments: {
                        ACTION: {
                            type: ArgumentType.STRING,
                            menu: 'dockMenu',
                            defaultValue: 'in'
                        }
                    }
                },
                // {
                //     opcode: 'moveForward',
                //     blockType: BlockType.COMMAND,
                //     text: 'move [X]m forward in [TIME] seconds',
                //     arguments: {
                //         X: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 1.0
                //         },
                //         TIME: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 2
                //         },
                //     }
                // },
                // {
                //     opcode: 'moveRotate',
                //     blockType: BlockType.COMMAND,
                //     text: 'rotate [THETA] degrees in [TIME] seconds',
                //     arguments: {
                //         THETA: {
                //             type: ArgumentType.ANGLE,
                //             defaultValue: 0
                //         },
                //         TIME: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 2
                //         },
                //     }
                // },
                // {
                //     opcode: 'move3D',
                //     blockType: BlockType.COMMAND,
                //     text: 'move to X:[X] Y:[Y] THETA:[THETA] in [TIME] seconds',
                //     arguments: {
                //         X: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 1.0
                //         },
                //         Y: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 0.0
                //         },
                //         THETA: {
                //             type: ArgumentType.ANGLE,
                //             defaultValue: 0
                //         },
                //         TIME: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 2
                //         },
                //     }
                // },
                // {
                //     opcode: 'bodyPose',
                //     blockType: BlockType.COMMAND,
                //     text: 'orient body with roll:[X] pitch:[Y]',
                //     arguments: {
                //         X: {
                //             type: ArgumentType.ANGLE
                //         },
                //         Y: {
                //             type: ArgumentType.ANGLE
                //         },
                //     }
                // },
                '---',
                {
                    opcode: 'callApp',
                    blockType: BlockType.COMMAND,
                    text: 'spot call [APP] wait: [WAIT]',
                    arguments: {
                        APP: {
                            type: ArgumentType.STRING,
                            menu: 'appMenu',
                            defaultValue: this._appNames()[0].text
                        },
                        WAIT: {
                            type: ArgumentType.BOOLEAN,
                            menu: 'booleanMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                {
                    opcode: 'stopApp',
                    blockType: BlockType.COMMAND,
                    text: 'spot stop [APP]',
                    arguments: {
                        APP: {
                            type: ArgumentType.STRING,
                            menu: 'appMenu',
                            defaultValue: this._appNames()[0].text
                        }
                    }
                }
            ],
            menus: {
                soundMenu: ['1', '2', '3', '4', '5'],
                booleanMenu: ['true', 'false'],
                claimMenu: ['claim', 'release'],
                powerMenu: ['on', 'off'],
                actionMenu: ['stand', 'sit'],
                dockMenu: ['in', 'out'],
                appMenu: '_appNames',
            }
        };
    }
}

module.exports = Scratch3SpotRobotBlocks;
