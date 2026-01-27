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
    }

    // customize to handle unadvertised topics
    moveForward ({SPEED}, util) {
        const TOPIC = "/cmd_vel_sub"
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
        return this.ros.callService("/push_action_align", {}).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    DriveService ({}, util) {
        return this.ros.callService("/push_action_drive", {}).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    RotateLeftService ({}, util) {
        return this.ros.callService("/push_action_rotate", {data: true}).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    RotateRightService ({}, util) {
        return this.ros.callService("/push_action_rotate", {data: false}).
            then(val => JSON.stringify(val)).
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
                    text: 'Drive Rcjbot forward 1 field',
                    arguments: {}
                },
                {
                    opcode: 'RotateLeftService',
                    blockType: BlockType.COMMAND,
                    text: 'Turn Rcjbot left',
                    arguments: {}
                },
                {
                    opcode: 'RotateRightService',
                    blockType: BlockType.COMMAND,
                    text: 'Turn Rcjbot right',
                    arguments: {}
                },
                {
                    opcode: 'ShowFrontDistance',
                    blockType: BlockType.REPORTER,
                    text: 'Front distance',
                    arguments: {}
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
