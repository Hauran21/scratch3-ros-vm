const Cast = require('../../util/cast');
const {Scratch3RosBase, RosUtil} = require('./RosUtil');
const ROSLIB = require('roslib');
const icon = require('./icon');

class Scratch3RobotBase extends Scratch3RosBase {

    constructor(extensionName, extensionId, soundServer, soundServerJp, runtime,
                masterURI, firstConnect) {
        super(extensionName, extensionId, runtime, masterURI, firstConnect);
        this.app_list = [{name:'app', text:'App'}];
        this.active_apps = [];
        this.sound_server = soundServer;
        this.sound_server_jp = soundServerJp;
        this.icon = icon;

        this._stopApps = this._stopApps.bind(this);
        this.runtime.on('PROJECT_STOP_ALL', this._stopApps.bind(this));
    }

    connect (url) {
        super.connect(url);
        if (this.ros) {
            this.ros.on('connection', () => {
                console.log("Setting sound servers...");
                this._setSoundServer(this.sound_server);
                this._setSoundServer(this.sound_server_jp, true);
            });
        }
    }

    _stopApp (app, raiseError) {
        var msg = {name: app.name};
        this.ros.getParam('/robot/name').get(robotName =>
            this.ros.callService('/' + robotName + '/stop_app', msg).
                then(res => res.message).
                catch(err => raiseError ? this._reportError(err) : console.error(err)));
    }

    _stopApps () {
        for (const app of this.active_apps) {
            console.log('Stopping ' + app.text + ' app ...');
            this._stopApp(app);
        }
    }

    _appNames () {
        if (this.ros) {
            const that = this;
            this.ros.getParam('/robot/name').get(robotName =>
              this.ros.callService('/' + robotName + '/list_apps', {}).
                then(res =>
                     that.app_list = res.available_apps.map(val => ({name: val.name, text: val.display_name}))).
                catch(console.error));
        };
        if (this.app_list.length != 0)
            return this.app_list;
        return [{name:'app', text:'App'}];
    }

    _waitPromise (p) {
        return new Promise((resolve, reject) => {
            p.then(val => resolve()).
                catch(reject);
        });
    }

    _waitMessage (topic, test, unsubscribe) {
        const that = this;
        return new Promise((resolve, reject) => {
            that.ros.getTopic(topic).then(rosTopic => {
                rosTopic.subscribe(msg => {
                    // always return on first message if no test function is given
                    if (test === undefined || test(msg)) {
                        if (unsubscribe) rosTopic.unsubscribe();
                        resolve();
                    }
                })
            }).
                catch(reject);
        });
    }

    _waitApp (app, robotName) {
        var statusTopic = '/' + robotName + '/application/app_status';
        var expectedStart = "launching " + app.text;
        var expectedStop = "stopping " + app.text;
        return new Promise((resolve, reject) => {
            this._waitMessage(statusTopic,
                              msg => msg.status == expectedStart).
                then(val => {
                    this._waitMessage(statusTopic,
                                      // can have an additional cause
                                      // e.g. stopping <app> by timeout
                                      msg => msg.status.startsWith(expectedStop)).
                        then(val => {
                            this.active_apps.splice(this.active_apps.indexOf(app));
                            resolve();
                        }).
                        catch(reject);
                }).
                catch(reject);
        });
    }

    _soundRequest (server, request, wait) {
        return this._waitPromise(this.ros.callActionInstance(server, request, wait)).
            catch(err => this._reportError(err));
    }

    _setSoundServer (server, japanese=false) {
        if (typeof server == 'string') {
            let newServer =  new ROSLIB.ActionClient({
                ros: this.ros,
                serverName: server,
                actionName: 'sound_play/SoundRequestAction'
            });
            if (japanese)
                this.sound_server_jp = newServer;
            else
                this.sound_server = newServer;
        }
    }

    // Color utility
    _randomizedColor (baseColor) {
        let rate = 0x111111;
        let modifier = (Math.random() + 1).toString(16).substring(2,8);
        modifier = parseInt(modifier, 16);
        let result = baseColor + (modifier & rate);
        result = result.toString(16).padStart(6, 0);
        return "#" + result;
    }

    query ({TEXT}) {
        return confirm(TEXT);
    }

    playSound ({SOUND, WAIT}) {
        SOUND = Cast.toNumber(SOUND);
        WAIT = Cast.toBoolean(WAIT);
        this._setSoundServer(this.sound_server);
        const msg = {
            sound_request: {
                sound: SOUND,
                command: 1,
                volume: 1.0
            }
        }
        return this._soundRequest(this.sound_server, msg, WAIT);
    }

    speakText ({TEXT, WAIT}) {
        WAIT = Cast.toBoolean(WAIT);
        this._setSoundServer(this.sound_server);
        const msg = {
            sound_request: {
                sound: -3,
                command: 1,
                volume: 1.0,
                arg: TEXT
            }
        }
        return this._soundRequest(this.sound_server, msg, WAIT);
    }

    speakTextJp ({TEXT, WAIT}) {
        WAIT = Cast.toBoolean(WAIT);
        this._setSoundServer(this.sound_server_jp, true);
        const msg = {
            sound_request: {
                sound: -3,
                command: 1,
                volume: 1.0,
                arg: TEXT
            }
        }
        return this._soundRequest(this.sound_server_jp, msg, WAIT);
    }

    callApp ({APP, WAIT}) {
        WAIT = Cast.toBoolean(WAIT);
        var app = this.app_list.find(val => val.text === APP);
        if (!app)
            return this._reportError('App ' + APP + ' does not exist');
        var msg = {name: app.name};
        return new Promise(resolve => {
            this.ros.getParam('/robot/name').get(robotName => {
                if (robotName === null)
                    return this._reportError('Rosparam /robot/name does not exist');
                this.active_apps.push(app);
                this.ros.callService('/' + robotName + '/start_app', msg).
                    then(res => res.message).
                    catch(err => this._reportError(err));
                if (WAIT) {
                    this._waitApp(app, robotName).
                        then(val => resolve()).
                        catch(err => this._reportError(err));
                }
                else {
                    this._waitApp(app, robotName).
                        catch(err => this._reportError(err));
                    resolve();
                }
            });
        });
    }

    stopApp ({APP}) {
        var app = this.app_list.find(val => val.text === APP);
        if (!app)
            return this._reportError('App ' + APP + ' does not exist');
        this._stopApp(app, true);
    }
}

module.exports = Scratch3RobotBase;
