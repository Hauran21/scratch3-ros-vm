const math = require('mathjs');
const JSON = require('circular-json');
const ROSLIB = require('roslib');
const Scratch3LooksBlocks = require('../../blocks/scratch3_looks.js')
const Variable = require('../../engine/variable');

class RosUtil extends ROSLIB.Ros {
    constructor (runtime, extensionId, options) {
        super(options);

        this.runtime = runtime;
        this.extensionId = extensionId;
        this.everConnected = false;
        this.active_processes = []
        this._stopProcesses = this._stopProcesses.bind(this);

        this.on('connection', () => {
            this.everConnected = true;
            this.runtime.on('PROJECT_STOP_ALL', this._stopProcesses.bind(this));
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTED);
        });

        this.on('close', () => {
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED);
            if (this.everConnected) {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTION_LOST_ERROR, {
                    message: `Scratch lost connection to`,
                    extensionId: this.extensionId
                });
            }
        });

        this.on('error', () => {
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_DISCONNECTED);
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                message: `Scratch lost connection to`,
                extensionId: this.extensionId
            });
        });
    }

    // Stop pending actions
    _stopProcesses () {
        for(const goal of this.active_processes) {
            console.log('Stopping ' + goal.actionClient.serverName + ' action ...');
            goal.cancel();
        }
        // Processes are removed from active_processes in the callAction callback
        // this.active_processes = [];
    }

    // Main functions
    getTopic (name) {
        const ros = this;
        if (name && !name.startsWith('/')) name = `/${name}`;
        return new Promise((resolve, reject) => {
            ros.getTopicType(
                name,
                type => {
                    if (!type) reject('Topic ' + name + ' does not exist');
                    resolve(new ROSLIB.Topic({
                        ros: ros,
                        name: name,
                        messageType: type
                    }));
                },
                reject);
        });
    }

    getAction (name) {
        const ros = this;
        let goal_name = name + '/goal';
        return new Promise((resolve, reject) => {
            ros.getTopicType(
                goal_name,
                type => {
                    if (!type)
                        reject('Action server ' + name + ' does not exist');
                    let sub = 'Goal';
                    if (type.endsWith(sub)) {
                        type = type.substring(0, type.length-sub.length);
                    }
                    resolve(new ROSLIB.ActionClient({
                        ros: ros,
                        serverName: name,
                        actionName: type
                    }));
                },
                reject);
        });
    }

    getService (name) {
        const ros = this;
        return new Promise((resolve, reject) => {
            ros.getServiceType(
                name,
                type => {
                    if (!type)
                        reject('Service ' + name + ' does not exist');
                    resolve(new ROSLIB.Service({
                        ros: ros,
                        name: name,
                        serviceType: type
                    }));
                },
                reject);
        });
    }

    getParam (name) {
        return this.Param({
            ros: this,
            name: name
        });
    }

    publishTopic (name, msg) {
        return new Promise((resolve, reject) => {
            this.getTopic(name).then(rosTopic => {
                rosTopic.publish(msg);
                resolve(true);
            }).
                catch(reject);
        });
    }

    subscribeTopic (name, callback, unsubscribe) {
        return new Promise((resolve, reject) => {
            this.getTopic(name).then(rosTopic => {
                rosTopic.subscribe(msg => {
                    if (unsubscribe) rosTopic.unsubscribe();
                    resolve(callback(msg));
                });
            }).
                catch(reject);
        });
    }

    callService (name, req, unadvertise) {
        return new Promise((resolve, reject) => {
            this.getService(name).then(rosService => {
                rosService.callService(req,
                    res => {
                        if (unadvertise) rosService.unadvertise();
                        resolve(res);
                    },
                    reject);
            }).
                catch(reject);
        });
    }

    callActionInstance (action, req, sync=true, unsubscribe) {
        const that = this;
        return new Promise(resolve => {
            let goal = new ROSLIB.Goal({
                actionClient: action,
                goalMessage: req
            });
            this.active_processes.push(goal);
            goal.on('result', res => {
                that.active_processes.splice(that.active_processes.indexOf(goal));
                if (unsubscribe) action.dispose();
                if (sync) resolve(res);
            });
            goal.send();
            if (!sync) resolve(true);
        });
    }

    callAction (name, req, unsubscribe) {
        return new Promise((resolve, reject) => {
            this.getAction(name).then(rosAction => {
                this.callActionInstance(rosAction, req, false, unsubscribe).
                    then(resolve).
                    catch(reject);
            }).
                catch(reject);
        });
    }

    callSyncAction (name, req, unsubscribe) {
        return new Promise((resolve, reject) => {
            this.getAction(name).then(rosAction => {
                this.callActionInstance(rosAction, req, true, unsubscribe).
                    then(resolve).
                    catch(reject);
            }).
                catch(reject);
        });
    }

    getActionResult (name) {
        let result_name = name + '/result';
        return new Promise((resolve, reject) => {
            this.subscribeTopic(result_name, resolve).
                catch(reject);
        });
    }

    cancelAction (name) {
        let cancel_name = name + '/cancel';
        return this.publishTopic(cancel_name, {});
    }

    getRosType (val) {
        switch (typeof val) {
        case 'boolean':
            return 'std_msgs/Bool';
        case 'number':
            return (val % 1 === 0) ? 'std_msgs/Int32' : 'std_msgs/Float64';
        default:
            return 'std_msgs/String';
        }
    }
}

class Scratch3RosBase {

    constructor (extensionName, extensionId, runtime, masterURI, firstConnect=true) {
        this.masterURI = masterURI;
        this.runtime = runtime;
        this.firstConnect = firstConnect;

        if (!this.firstConnect || !this.masterURI) {
            this.masterURI = prompt('Master URI:');
            this.firstConnect = true;
        }

        if (!extensionId.includes(":")) {
            // generate randomized identifier to enable multiple
            // extensions with different masters
            let instanceId = (Math.random() + 1).toString(36).substring(2);
            this.extensionId = extensionId + ':' + instanceId;
        }
        else {
            // keep the same instanceId when loading from file
            // also, manually start the connection
            this.extensionId = extensionId;
            this.connect('ws://' + this.masterURI + ':9090');
        }

        this.extensionName = extensionName + '\n' + this.masterURI;
        this.runtime.registerPeripheralExtension(this.extensionId, this);

        math.config({matrix: 'Array'});

        this.topicNames = ['/topic'];
        this.actionNames = ['/action'];
        this.serviceNames = ['/service'];
        this.paramNames = ['/param'];
    }

    // Peripheral connection functions
    scan () {
        if (!this.firstConnect || !this.masterURI) {
            this.masterURI = prompt('Master URI:');
        }
        if (this.firstConnect) this.firstConnect = false;
        this.connect('ws://' + this.masterURI + ':9090');
    }

    connect (url) {
        try {
            this.ros = new RosUtil(this.runtime, this.extensionId, {url: url});
        } catch (err) {
            console.error(err);
            this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                message: `Scratch couldn't connect to`,
                extensionId: this.extensionId
            });
        }
    }

    disconnect () {
        if (this.ros) {
            this.ros.socket.close();
        }
    }

    isConnected () {
        if (this.ros) return this.ros.isConnected;
        return false;
    }

    // Error handling
    _reportError(err) {
        console.error(err);
        // emit PROJECT_STOP_ALL and run all required callbacks
        this.runtime.stopAll();
        // make the asset report the error
        const target = this.runtime.getEditingTarget();
        this.runtime.emit(Scratch3LooksBlocks.SAY_OR_THINK, target, 'say', err);
    }

    // JSON utility
    _isJSON (value) {
        return value && typeof value === 'object' && value.constructor === Object;
    }

    _tryParse (value, reject) {
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (err) {
            return reject;
        }
    }

    // Variable utility
    _getVariableValue (variable, target, type) {
        if (typeof variable === 'string') {
            if (target) variable = target.lookupVariableByNameAndType(variable, type);
            else {
                let tmp;
                for (const target of this.runtime.targets) {
                    tmp = target.lookupVariableByNameAndType(variable, type);
                    if (tmp) {
                        variable = tmp;
                        break;
                    }
                }
            }
        }
        return variable && this._tryParse(variable.value, variable.value);
    }

    _changeVariableVisibility ({VAR, SLOT}, visible) {
        const target = this.runtime.getEditingTarget();
        const variable = target.lookupVariableByNameAndType(VAR);
        const id = variable && `${variable.id}${VAR}.${SLOT}`;
        if (!id) return;

        if (visible && !(this.runtime.monitorBlocks._blocks[id])) {
            const isLocal = !(this.runtime.getTargetForStage().variables[variable.id]);
            const targetId = isLocal ? target.id : null;
            this.runtime.monitorBlocks.createBlock({
                id: id,
                targetId: targetId,
                opcode: `${this.extensionId}_getSlot`,
                fields: {OBJECT: {value: VAR}, SLOT: {value: SLOT}}
            });
        }

        this.runtime.monitorBlocks.changeBlock({
            id: id,
            element: 'checkbox',
            value: visible
        }, this.runtime);
    }

    // Dynamic menus
    _updateTopicList () {
        if (this.ros) {
            const that = this;
            this.ros.getTopics(topics => {
                that.topicNames = topics.topics.sort();
            },
            console.error);
        }
        if (this.topicNames != 0)
            return this.topicNames.map(val => ({value: val, text: val}));
        return ['/topic'];
    }

    _updateActionList () {
        if (this.ros) {
            const that = this;
            this.ros.getTopics(topics => {
                let sub = '/feedback';
                let actions = topics.topics.filter(val => val.endsWith(sub)).sort();
                that.actionNames = actions.map(val => val.substring(0, val.length-sub.length));
            },
            console.error);
        }
        if (this.actionNames.length != 0)
            return this.actionNames.map(val => ({value: val, text: val}));
        return ['/action'];
    }

    _updateServiceList () {
        if (this.ros) {
            const that = this;
            this.ros.getServices(services => {
                that.serviceNames = services.sort();
            },
            console.error);
        }
        if (this.serviceNames.length != 0)
            return this.serviceNames.map(val => ({value: val, text: val}));
        return ['/service'];
    }

    _updateParamList () {
        if (this.ros) {
            const that = this;
            this.ros.getParams(params => {
                that.paramNames = params.sort();
            },
            console.error);
        }
        if (this.paramNames.length != 0)
            return this.paramNames.map(val => ({value: val, text: val}));
        return ['/param'];
    }

    _updateVariableList () {
        let varlist;
        try {
            varlist = this.runtime.getEditingTarget().getAllVariableNamesInScopeByType();
        } catch (err) {
            return [{value: 'my variable', text: 'my variable'}];
        }

        if (varlist.length === 0) return [{value: 'my variable', text: 'my variable'}];
        return varlist.map(val => ({value: val, text: val}));
    }

    _updateListVariableList () {
        let varlist;
        try {
            varlist = this.runtime.getEditingTarget().getAllVariableNamesInScopeByType(
                Variable.LIST_TYPE);
        } catch (err) {
            return [{value: 'my list', text: 'my list'}];
        }

        if (varlist.length === 0) return [{value: 'my list', text: 'my list'}];
        return varlist.map(val => ({value: val, text: val}));
    }

    // TODO: allow returning Promises for dynamic menus or update them periodically
}

module.exports = {
    Scratch3RosBase: Scratch3RosBase,
    RosUtil: RosUtil
};
