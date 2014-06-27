#!/usr/bin/env node
var sys = require('sys'),
    express = require('express'),
    packages = require('./libs/packages'),
    o_ = require('./libs/utils');

o_.merge(global, require('./settings'));
try { o_.merge(global, require('./settings.local')); } catch(e) {}

var app = express();
//app.set('env', 'development');
app.use(require('method-override')());
app.use(require('cookie-parser')());;
app.use(require('body-parser')());;
app.use(require('./middleware/im')({
   maxAge: 15 * 60 * 1000,
   reapInterval: 60 * 1000,
   authentication: require('./libs/authentication/' + AUTH_LIBRARY)
}));

app.set('root', __dirname);

if ('development' == app.get('env')) {
    app.set('views', __dirname + '/dev/views');
    app.set('view engine', 'jade');
    
    app.use(require("morgan")());
    require('./dev/app')('/dev', app);
    app.use(express.static(
                require('path').join(__dirname, '../client')));
    app.use(require('express-error-handler')({dumpExceptions: true, showStack: true}));
}

app.listen(APP_PORT, APP_HOST);

// Listener endpoint; handled in middleware
app.get('/app/listen', function(){});

app.use('/app/message', function(req, res) {
    res.find(req.param('to'), function(to) {
        if(to) {
            res.message(to, req.event);
        } else {
            req.event._status = {sent: false, e: 'not online'};
            res.jsonp(req.event);
        }
    });
});

app.use('/app/message/typing', function(req, res) {
    if(~packages.TYPING_STATES.indexOf('typing' + req.param('state'))) {
        res.find(req.param('to'), function(user) {
            if(user) {
                req.event.status = 'typing' + req.param('state');
                res.message(user, req.event);
            } else {
                // Typing updates do not receive confirmations,
                // as they are not important enough.
                req.event._status = {sent: false, e: 'invalid user'};
                res.jsonp(req.event);
            }
        });
    } else {
        req.event._status = {sent: false, e: 'invalid state'};
        res.jsonp(req.event);
    }
});

app.use('/app/status', function(req, res) {
    if(~packages.STATUSES.indexOf(req.param('status'))) {
        res.status(req.event);
    } else {
        req.event._status = {sent: false, e: 'invalid status'};
        res.jsonp(req.event);
    }
});

app.use('/app/noop', function(req, res) {
    req.event._status = {sent: true};
    res.jsonp(req.event);
});

app.use('/app/signoff', function(req, res) {
    res.signOff(req.event);
});

console.log('Ajax IM server started...');
