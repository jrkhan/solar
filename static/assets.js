module.exports = (function() {

    var shadersInProgress = 0;
    var readyHandlers = [];
    function gotShader() {
        shadersInProgress--;
        if ( shadersInProgress == 0) {
            ready();
        }
    }

    function getShader(path, callback) {
        gettingShader();
        $.get(path, function(data){
            callback(data);
            gotShader();
        });
    }

    function gettingShader() {
        shadersInProgress++;
    }

    function addReadyHandler(f) {
        if ( shadersInProgress == 0 ) {
            f();
        } else {
            readyHandlers.push(f);
        }
    }

    function ready() {
        for ( var i = 0; i < readyHandlers.length; i++ ) {
            readyHandlers[i]();
        }
    }

    return {
        addReadyHandler: addReadyHandler,
        gotShader: gotShader,
        gettingShader: gettingShader,
        getShader: getShader
    }
})();
