// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window*/

define(['lib/domplate/lib/domplate', 'opm/Connection', 'OrchardView', 'OrchardModel', 'q/q', 'opm/clickSome'], 
function(                 Domplate,       connection,   OrchardView,   OrchardModel,     Q,        clickSome) {

  var click = clickSome.click;
  var grabClicks = clickSome.click;
  var getAncestorByClassName = clickSome.getAncestorByClassName;
  var Controls = clickSome.Controls;

  var templates = {};
  var dp = Domplate.tags;

  templates.overview = Domplate.domplate({
      tag: 
        dp.DIV({'class':'opView'},
          dp.SPAN({'class':'pageTitle textAnnotate'}, "Orchard Project Manager"),
          dp.SPAN({'class':'orchardSelector', _orchardManager:'$orchardManager', onclick: '$orchardManager|getOpenOrchardMenu'},
            '$selectedOrchard|getSelectedOrchardText')
        ),
        
      getSelectedOrchardText: function(selectedOrchard) {
        return selectedOrchard || 'No sites defined';
      },
      
      getOpenOrchardMenu: function(manager) {
        return function(event) {
          var selectedOrchardElt = event.currentTarget;
          var orchardSelector = templates.orchardSelector.tag.insertAfter(
            {orchardManager: manager},
            selectedOrchardElt
          );
          orchardSelector.style.left = selectedOrchardElt.offsetLeft +'px';
        }.bind(this);
      }
  });
  
  templates.orchardSelector = Domplate.domplate({
      tag: 
        dp.DIV({'class':'overlay'}, 
          dp.FOR('orchardName', '$orchardManager|getOrchardNames', 
            dp.DIV({'class':'orchardName', _repObject: '$orchardName'}, '$orchardName')
          ),
          dp.TAG(Controls.identifierInput.tag, {prompt: 'New Orchard Name', 'onInput': '$orchardManager|getAddSite'})
        ),
      
      getOrchardNames: function(orchardManager) {
        return orchardManager.getOrchardNames();
      },
      
      getAddSite: function(orchardManager) {
        return function(identifier) {
          var orchards = orchardManager.getOrchardNames();
          if (orchards.indexOf(identifier) !== -1) {
            return identifier+' is already used';
          } else {
            this.addSite(identifier, orchardManager);
          }
        }.bind(this);
      },
      
      addSite: function(identifier, orchardManager) {
        identifier = OrchardModel.toOrchardIdentifier(identifier);
        connection.postObject(
          orchardManager.getCreateSiteURL(),
          {
            'Workspace' : connection.workspace.Id,
            'Name': identifier
          },
          this.updateSiteList.bind(this),
          this.updateFailed.bind(this, identifier)
        );
      },
      
      updateSiteList: function() {
      },
      
      updateFailed: function(identifier) {
        console.error('Could not create site '+identifier);
      }
    
  });
  
  templates.sites = Domplate.domplate({
    tag: 
      dp.FOR('site', '$sites', 
        dp.TAG(OrchardView.projects.tag, {site: '$site'})
      )
  });
        
  var opm = {
    
    render: function(connection) {
      console.log("render", connection);
      this.connection = connection; 
      var orchardNames = Object.keys(this.orchardModels);
      var selectedOrchard = orchardNames.pop() || '';
      var overview = templates.overview.tag.append(
        {orchardManager: this, selectedOrchard: this.selectedOrchard}, 
        window.document.body
      );
      if (!selectedOrchard) {
        window.setTimeout(function() {
          var adder = overview.querySelector('.orchardSelector');
          click(adder);
        });
      }

    },
    
    getOrchardNames: function() {
      return Object.keys(this.orchardModels);
    },
    
    getCreateSiteURL: function() {
      return '/site';
    },
    
    buildOrchardModels: function(thenCall) {
      connection.load(function() {
        connection.getSiteNames().forEach(function(siteName) {
          this.orchardModels = {};
          if (OrchardModel.isOrchardIdentifier(siteName)) {
            var siteModel = connection.siteModels[siteName];
            this.orchardModels[siteName] = OrchardModel.new(siteName, siteModel, connection.projectsModel);
          }
        }.bind(this));
        thenCall.call(this, connection);
      }.bind(this));
    },
    
    buildPage: function() {
      this.buildOrchardModels(this.render.bind(this));
    }
    
  };
  
  return opm;
});