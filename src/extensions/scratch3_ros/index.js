const math = require('mathjs');
const JSON = require('circular-json');
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const Variable = require('../../engine/variable');
const ROSLIB = require('roslib');
const {Scratch3RosBase} = require('./RosUtil');
const icon = require('./icon');

class Scratch3RosBlocks extends Scratch3RosBase {

    constructor(runtime, extensionId) {
        super('ROS', extensionId ? extensionId : 'ros', runtime);
    }

    // customize to handle topics advertised from Scratch
    subscribeTopic ({TOPIC}) {
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
                    });
                }).catch(err => this._reportError(err));
        });
    }

    // customize to handle unadvertised topics
    publishTopic ({MSG, TOPIC}, util) {
        if (TOPIC && !TOPIC.startsWith('/')) TOPIC = `/${TOPIC}`;
        const msg = this._getVariableValue(MSG, util.target) || this._tryParse(REQUEST);
        if (!this._isJSON(msg)) msg = {data: msg};
        this.ros.publishTopic(TOPIC, msg).catch(err => {
            console.log(err);
            console.log("Advertising a new topic...");
            var rosTopic = new ROSLIB.Topic({
                ros : this.ros,
                name : TOPIC,
                messageType : this.ros.getRosType(msg.data),
            });
            rosTopic.publish(msg);
        }).catch(err => this._reportError(err));
    }

    callService ({REQUEST, SERVICE}, util) {
        const req = this._getVariableValue(REQUEST, util.target) || this._tryParse(REQUEST);
        return this.ros.callService(SERVICE, req).
            then(val => JSON.stringify(val)).
            catch(err => this._reportError(err));
    }

    callAction ({REQUEST, ACTION}, util) {
        const req = this._getVariableValue(REQUEST, util.target) || this._tryParse(REQUEST);
        this.ros.callAction(ACTION, req).
            catch(err => this._reportError(err));
    }

    getActionResult({ACTION}, util) {
        return this.ros.getActionResult(ACTION).
            then(val => JSON.stringify(val.result)).
            catch(err => this._reportError(err));
    }

    cancelAction ({ACTION}, util) {
        this.ros.cancelAction(ACTION).
            catch(err => this._reportError(err));
    }

    getParamValue ({NAME}) {
        const that = this;
        return new Promise(resolve => {
            const param = that.ros.getParam(NAME);
            param.get(val => {
                if (val === null)
                    return this._reportError('Rosparam ' + NAME + ' does not exist');
                if (that._isJSON(val)) {
                    val.toString = function () { return JSON.stringify(this); };
                }
                resolve(val);
            });
        });
    }

    setParamValue ({NAME, VALUE}) {
        const param = this.ros.getParam(NAME);
        const val = Array.isArray(VALUE) ?
            VALUE.map(v => this._tryParse(v, v)) :
            this._tryParse(VALUE, VALUE);
        param.set(val);
    }

    getSlot ({OBJECT, SLOT}, util) {
        const evalSlot = function (obj, slots) {
            const slotArr = slots.split(/\.|\[|\]/).filter(Boolean);
            for (let i = 0; i < slotArr.length; i++) {
                if (!obj) return;
                obj = obj[slotArr[i]];
            }
            return obj;
        };

        const variable = util.target.lookupVariableByNameAndType(OBJECT);
        const obj = this._getVariableValue(variable) || this._tryParse(OBJECT);
        const res = (this._isJSON(obj) || void 0) && evalSlot(obj, SLOT);
        if (util.thread.updateMonitor) {
            if (typeof res === 'undefined') {
                const name = `${OBJECT}.${SLOT}`;
                const id = variable ?
                    variable.id + name :
                    Object.keys(util.runtime.monitorBlocks._blocks)
                        .find(key => key.search(name) >= 0);

                util.runtime.monitorBlocks.deleteBlock(id);
                util.runtime.requestRemoveMonitor(id);
            } else return JSON.stringify(res);
        }
        if (this._isJSON(res)) res.toString = function () { return JSON.stringify(this); };
        return res;
    }

    setSlot ({VAR, SLOT, VALUE}, util) {
        const setNestedValue = function (obj, slots, value) {
            const last = slots.length - 1;
            for (let i = 0; i < last; i++) {
                const slot = slots[i];
                if (!obj.hasOwnProperty(slot) || typeof obj[slot] !== 'object') {
                    obj[slot] = isNaN(parseInt([slots[i + 1]])) ? {} : [];
                }
                obj = obj[slot];
            }
            obj[slots[last]] = value;
        };

        const variable = util.target.lookupVariableByNameAndType(VAR);
        if (!variable) return;
        const variableValue = this._getVariableValue(variable);

        if (this._isJSON(variableValue)) {
            // Clone object to avoid overwriting parent variables
            variable.value = JSON.parse(JSON.stringify(variableValue));
        } else variable.value = {};
        const slt = SLOT.split(/\.|\[|\]/).filter(Boolean);
        const val = Array.isArray(VALUE) ?
            VALUE.map(v => this._tryParse(v, v)) :
            this._tryParse(VALUE, VALUE);

        setNestedValue(variable.value, slt, val);

        // TODO: cloud variables
    }

    setListTo ({VAR, VALUE}, util) {
        const list = util.target.lookupVariableByNameAndType(VAR, Variable.LIST_TYPE);
        if (!list) return;
        const val = Array.isArray(VALUE) ?
              VALUE.map(v => this._tryParse(v, v)) :
              this._tryParse(VALUE, VALUE);
        if (!(Array.isArray(val))) return;
        // update values
        list.value = val;
        list._monitorUpToDate = false;
    }

    showVariable (args) {
        this._changeVariableVisibility(args, true);
    }

    hideVariable (args) {
        this._changeVariableVisibility(args, false);
    }

    solveFormula ({EXPRESSION, OBJECT}, util) {
        const obj = this._getVariableValue(OBJECT, util.target) || this._tryParse(OBJECT);
        let binds;
        if (this._isJSON(obj)) {
            binds = JSON.parse(JSON.stringify(obj));
            delete binds.toString;
            delete binds.constructor;
        } else {
            binds = {};
            binds[OBJECT] = obj;
        }

        try {
            const result = math.eval(EXPRESSION, binds);
            if (math.typeof(result) === 'Unit') return result.toNumber();
            return result;
        } catch (err) {
            return;
        }
    }

    getInfo () {
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
                    opcode: 'subscribeTopic',
                    blockType: BlockType.REPORTER,
                    text: 'Get message from [TOPIC]',
                    arguments: {
                        TOPIC: topicArg
                    }
                },
                {
                    opcode: 'publishTopic',
                    blockType: BlockType.COMMAND,
                    text: 'Publish [MSG] to [TOPIC]',
                    arguments: {
                        MSG: variableArg,
                        TOPIC: topicArg
                    }
                },
                '---',
                {
                    opcode: 'callService',
                    blockType: BlockType.REPORTER,
                    text: 'Send [REQUEST] to [SERVICE]',
                    arguments: {
                        REQUEST: variableArg,
                        SERVICE: serviceArg
                    }
                },
                '---',
                {
                    opcode: 'callAction',
                    blockType: BlockType.COMMAND,
                    text: 'Send [REQUEST] to [ACTION]',
                    arguments: {
                        REQUEST: variableArg,
                        ACTION: actionArg,
                    }
                },
                {
                    opcode: 'getActionResult',
                    blockType: BlockType.REPORTER,
                    text: 'Get [ACTION] result',
                    arguments: {
                        ACTION: actionArg,
                    }
                },
                {
                    opcode: 'cancelAction',
                    blockType: BlockType.COMMAND,
                    text: 'Cancel [ACTION]',
                    arguments: {
                        ACTION: actionArg,
                    }
                },
                '---',
                {
                    opcode: 'getParamValue',
                    blockType: BlockType.REPORTER,
                    text: 'Get rosparam [NAME]',
                    arguments: {
                        NAME: paramArg
                    }
                },
                {
                    opcode: 'setParamValue',
                    blockType: BlockType.COMMAND,
                    text: 'Set rosparam [NAME] to [VALUE]',
                    arguments: {
                        NAME: paramArg,
                        VALUE: stringArg(0)
                    }
                },
                '---',
                {
                    opcode: 'getSlot',
                    blockType: BlockType.REPORTER,
                    text: 'Get [OBJECT] [SLOT]',
                    arguments: {
                        OBJECT: variableArg,
                        SLOT: stringArg('data')
                    }
                },
                {
                    opcode: 'setSlot',
                    blockType: BlockType.COMMAND,
                    text: 'Set [VAR] [SLOT] to [VALUE]',
                    arguments: {
                        VAR: variableArg,
                        SLOT: stringArg('data'),
                        VALUE: stringArg('Hello!')
                    }
                },
                {
                    opcode: 'setListTo',
                    blockType: BlockType.COMMAND,
                    text: 'Set [VAR] to [VALUE]',
                    arguments: {
                        VAR: listVariableArg,
                        VALUE: stringArg('[1,2,3]')
                    }
                },
                {
                    opcode: 'showVariable',
                    blockType: BlockType.COMMAND,
                    text: 'Show [VAR] [SLOT]',
                    arguments: {
                        VAR: variableArg,
                        SLOT: stringArg('data')
                    }
                },
                {
                    opcode: 'hideVariable',
                    blockType: BlockType.COMMAND,
                    text: 'Hide [VAR] [SLOT]',
                    arguments: {
                        VAR: variableArg,
                        SLOT: stringArg('data')
                    }
                },
                '---',
                {
                    opcode: 'solveFormula',
                    blockType: BlockType.REPORTER,
                    text: '[EXPRESSION] binding [OBJECT]',
                    arguments: {
                        EXPRESSION: stringArg('(data + 1) ^ 2'),
                        OBJECT: variableArg
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

module.exports = Scratch3RosBlocks;
