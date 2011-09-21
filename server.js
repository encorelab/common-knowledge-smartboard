var sail = require('./js/sail.js/sail.node.server.js')

global.bosh.server = 'localhost'
global.rollcall.server = 'localhost'
global.rollcall.port = 3000

sail.server.start(8000)
