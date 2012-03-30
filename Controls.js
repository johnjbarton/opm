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
  
  var Controls = {
    grabClicks: grabClicks,
    getAncestorByClassName: getAncestorByClassName
  };

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
          event.stopPropagation();
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
  
  Controls.identifierMenu = Domplate.domplate({
    tag: dp.DIV({'class':'identifierMenu'},
           dp.FOR('item', '$list|getItems', 
             dp.DIV({'class': 'identifierMenuEntry', _repObject: '$item', 'onclick': '$list|getAction'},
               dp.SPAN({'class':'arrow-box'},
                 dp.SPAN({'class':'unicode-arrow-up-from-bar'}, '&#x21a5;')
               ),
               dp.SPAN({'class': 'identifierMenuItem'}, "$item")
             )
           ),
           dp.TAG(Controls.identifierInput.tag, {prompt: '$list|getPrompt', onInput: '$list|getOnInput'})
         ),
    getItems: function(list) {
      return list.getItems();
    },
      
    getTooltip: function(list) {
      return list.getTooltip();
    },
     
    getAction: function(list) {
      return list.getAction();
    },
    
    getPrompt: function(list) {
      return list.getPrompt();
    },
    
    getOnInput: function(list) {
      return list.getOnInput();
    }
  });
  
  Controls.identifierMenuOpener = Domplate.domplate({
      tag: 
        dp.DIV({'class':'identifierMenuOpener textAnnotate', 'onclick':'$list|toggleMenu', 'title':'Click to open menu'}, 
          dp.A({'class':'centerable menuButton'}, '&#x21DF; '+'$list|getTitle')
        ),
      
      getTitle: function(list) {
        return list.getTitle();
      },
      
      toggleMenu: function(list) {
        return function(event) {
          var menu = document.querySelector('.identifierMenu');
          if (menu) {
            this.closeMenu(event, list);
          } else {
            this.openMenu(event, list);
          }
        }.bind(this);
      },  
        
      openMenu: function(event, list) {    
        var elt = event.currentTarget;
        
        var addButton = elt.getElementsByClassName('centerable')[0];
          
        var overlay = Controls.identifierMenu.tag.insertAfter({list: list}, addButton);
/*        var left = addButton.offsetLeft;
        var parent = addButton.parentElement;
        while (parent && parent !== overlay.parentElement) {
          left += parent.offsetLeft;
          parent = parent.parentElement;
        }
        overlay.style.left = left +'px';
  */      addButton.classList.add('menuOpen');
      },
      
      closeMenu: function(event, overlay) {
        var elt = event.currentTarget;
        var menu = elt.querySelector('.identifierMenu');
        menu.parentElement.removeChild(menu);
        var addButton = elt.getElementsByClassName('centerable')[0];
        addButton.classList.remove('menuOpen');
      }
      
    });

  
  return Controls;

});