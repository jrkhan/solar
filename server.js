var express = require('express');
var app = express();
app.use('/three', express.static(__dirname + '/three'));
app.use('/ex', express.static(__dirname + '/three/examples/js'))
app.use('/', express.static(__dirname + '/static'));
app.use('/test', express.static(__dirname + '/test'));
app.use('/lib', express.static(__dirname + '/lib'));
app.listen(8003);
