// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define window console */

define([], 
function() {

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
  


  return {
    click: click,
    grabClicks: grabClicks,
    getAncestorByClassName: getAncestorByClassName
  };

});