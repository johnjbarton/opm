// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window*/

define(['lib/domplate/lib/domplate', 'opm/Connection', 'ProjectsView', 'q/q', 'opm/clickSome'], 
function(                 Domplate,      connection,   ProjectsView,     Q,        clickSome) {

  var click = clickSome.click;
  var grabClicks = clickSome.click;
  var getAncestorByClassName = clickSome.getAncestorByClassName;


  var templates = {};
  var dp = Domplate.tags;

  templates.overview = Domplate.domplate({
      tag: 
        dp.DIV({'class':'opView'},
          dp.SPAN({'class':'pageTitle textAnnotate'}, "Orchard Project Manager"),
          dp.SPAN({'class':'siteSelector', _sites:'$sites', onclick: '$sites|getOpenSiteMenu'},
            '$selectedSite')
        ),
      getOpenSiteMenu: function(sites) {
        return function(event) {
          var selectedSiteElt = event.currentTarget;
          var siteSelector = templates.siteSelector.tag.insertAfter(
            {sites: sites}, 
            selectedSiteElt
          );
          siteSelector.style.left = selectedSiteElt.offsetLeft +'px';
        };
      }
  });
  
  templates.siteSelector = Domplate.domplate({
      tag: 
        dp.DIV({'class':'overlay'}, 
          dp.FOR('site', '$sites', 
            dp.SPAN({'class':'siteName', _repObject: '$site'}, '$site')
          ),
          dp.INPUT({'class':'newSiteName', 'type':'text'}),
          dp.SPAN({'class': 'newSiteHint', 'onclick':'$sites|getRefocus'}, 'New Orchard Name')
        ),
      getRefocus: function() {
        return function(event) {
          event.currentTarget.previousSibling.focus();
        };
      }
  });
        
  var opm = {
    
    render: function(connection) {
      console.log("render");
      var siteNames = Object.keys(connection.siteModels);
      var selectedSite = siteNames.pop() || '';
      var overview = templates.overview.tag.append(
        {sites: siteNames, selectedSite: selectedSite}, 
        window.document.body
      );
      var sites = siteNames.forEach(function(siteName) {
        var siteModel = sites[siteName];
        var opView = ProjectsView.new(siteName, siteModel, connection.projectsModel);
        opView.render();
      });
      if (!selectedSite) {
        window.setTimeout(function() {
          var adder = overview.querySelector('.siteSelector');
          click(adder);
        });
      }

    },
    
    buildPage: function() {
      connection.load(function(conection) {
         opm.render(connection);
      });
    }
  };
  
  return opm;
});