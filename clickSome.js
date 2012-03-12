// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define window console */

define(['lib/domplate/lib/domplate'], 
function(                 Domplate) {

  function click(elt) {
    var event = window.document.createEvent('MouseEvents');
    event.initMouseEvent('click', true, true, window, 0,0,0,0,0, false, false, false, false, 0, null);
    return elt.dispatchEvent(event);
  }

  function grabClicks(thenClose) {
    function closeThenRemove(event) {
       thenClose.apply(null, [event]);  
       window.document.removeEventListener('click', closeThenRemove, false);
       window.document.removeEventListener('keydown', closeOnEscape, false);
    }
    function closeOnEscape(event) {
      if (event.which === 27) {  // escape
        closeThenRemove(event);
      }
    }
    window.document.addEventListener('click', closeThenRemove, false);
    window.document.addEventListener('keydown', closeOnEscape, false);
  }
  
  function getAncestorByClassName(elt, className) {
    var parent = elt.parentElement;
    while(parent) {
      if (parent.classList.contains(className)) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }
  
  var Controls = {};
  var dp = Domplate.tags;
  
  /* One word input control
  ** @param: prompt string 
  ** @param: onInput fn(identifier); return error string or false to accept
  */
  Controls.identifierInput = Domplate.domplate({
    tag: 
      dp.SPAN({'class':'identifierControl'},
        dp.INPUT({'class':'identifierInput', 'pattern':'\w*', 'onkeydown': '$onInput|acceptEnter', 'type':'text'}),
        dp.SPAN({'class': 'identifierPrompt', 'onclick':'$prompt|getRefocus'}, '$prompt')
      ),
 
      getRefocus: function() {
        return function(event) {
          event.currentTarget.previousSibling.focus();
        };
      },
      
      acceptEnter: function(onInput) {
        return function(event) {
          var input = event.currentTarget.parentElement.querySelector('.identifierInput');
          if (event.which === 13) {
            var identifier = input.value;
            if (!identifier) {
              return;  // ignore enter with no entry
            } else {
              var errorMessage = onInput(identifier);
              if (errorMessage) {
                window.alert(errorMessage);
              } else {
                // done for now
                input.value = '';
                this.showPrompt(input.parentElement, true);
              }
            }
          } else {
            this.showPrompt(input.parentElement, false);
          }
        }.bind(this);
      },
      
      showPrompt: function(controlElement, on) {
        var promptElement = controlElement.querySelector('.identifierPrompt');
        if (on) {
          promptElement.classList.remove('hidden');
        } else {
          promptElement.classList.add('hidden');
        }
      }

  });
  
  return {
    Controls: Controls,
    click: click,
    grabClicks: grabClicks,
    getAncestorByClassName: getAncestorByClassName
  };

});