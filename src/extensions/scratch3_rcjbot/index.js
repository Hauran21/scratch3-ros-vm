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
        SERVICE = "/cmd_vel_service"
        const req = this._getVariableValue(REQUEST, util.target) || this._tryParse(REQUEST);
        return this.ros.callService(SERVICE, req).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    //TODO subscriber
    showSpeed ({}) {
        const TOPIC = "/cmd_vel"
        const that = this;
        return new Promise(resolve => {
            that.ros.getTopic(TOPIC).then(
                rosTopic => {
                    rosTopic.subscribe(msg => {
                        // rosTopic.unsubscribe();
                        if (rosTopic.messageType === 'std_msgs/String') {
                            msg.data = that._tryParse(msg.data, msg.data);
                        }
                        msg.toString = function () { return JSON.stringify(this); };
                        msg.constructor = Object;
                        resolve(msg);
                        variableArg = msg.data;
                    });
                }).catch(err => this._reportError(err));
        });
    }

    getInfo () {


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
                        SPEED: {
                            type: ArgumentType.STRING,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'ServiceMoveForward',
                    blockType: BlockType.COMMAND,
                    text: 'Service move forward [REQUEST]',
                    arguments: {
                        REQUEST: {
                            type: ArgumentType.STRING,
                            defaultValue: ' data:\ false\ '
                        }
                    }
                },
                {
                    opcode: 'showSpeed',
                    blockType: BlockType.REPORTER,
                    text: 'Show current speed',
                    arguments: {
                        SPEED_SUB: variableArg
                    }
                }
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
