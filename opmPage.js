// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window*/

define(['lib/domplate/lib/domplate', 'opm/Connection', 'OrchardView', 'OrchardModel', 'q/q', 'opm/Controls'], 
function(                 Domplate,       connection,   OrchardView,   OrchardModel,     Q,        Controls) {

  var click = Controls.click;
  var getAncestorByClassName = Controls.getAncestorByClassName;

  var templates = {};
  var dp = Domplate.tags;

  templates.orchardSelector = Domplate.domplate({
      tag: 
        dp.SPAN({'class':'orchardSelector'}, 
          dp.TAG(Controls.identifierMenuOpener.tag, {list: '$orchardManager|getOrchardNamesAsList'})
        ),
      
      getOrchardNamesAsList: function(orchardManager) {
        
        return {
          getItems: function() {
            return orchardManager.getOrchardNames();
          },
          getAction: function() {
            return templates.orchardSelector.getSelectOrchard(orchardManager);
          },
          getTitle: function() {
            return orchardManager.getSelectedOrchardName();
          },
          getPrompt: function() {
            return 'New Orchard Name';
          },
          getOnInput: function() {
            return templates.orchardSelector.getAddOrchard(orchardManager);
          }
        };
      },
      
      getOrchardNames: function(orchardManager) {
        return orchardManager.getOrchardNames();
      },
      
      getSelectOrchard: function(orchardManager) {
        return function(event) {
          var orchardName = event.currentTarget.repObject;
          var orchardModel = orchardManager.orchardModels[orchardName];
          this.selectOrchard(orchardModel);
        }.bind(this);
      },
      
      selectOrchard: function(orchardModel) {
        var orchardElt = window.document.querySelector('.selectedOrchard');
        var orchardHolderElt = orchardElt ? orchardElt.parentElement : null;
        if (orchardHolderElt) {
          orchardHolderElt.removeChild(orchardElt);
        } else {
          orchardHolderElt = window.document.body;
        }
        templates.orchard.tag.append({orchardModel: orchardModel}, orchardHolderElt);
      },
      
      getAddOrchard: function(orchardManager) {
        return function(identifier) {
          var orchards = orchardManager.getOrchardNames();
          if (orchards.indexOf(identifier) !== -1) {
            return identifier+' is already used';
          } else {
            this.addOrchard(identifier, orchardManager);
          }
        }.bind(this);
      },
      
      addOrchard: function(identifier, orchardManager) {
        identifier = OrchardModel.toOrchardIdentifier(identifier);
        connection.postObject(
          orchardManager.getCreateSiteURL(),
          {
            'Workspace' : connection.workspace.Id,
            'Name': identifier
          },
          this.selectOrchard.bind(this, identifier),
          function(exc) {
            this.updateFailed(identifier, exc);
          }
        );
      },
      
      updateFailed: function(identifier, exc) {
        console.error('Could not create site '+identifier+': '+exc, exc);
      }
    
  });
  
  templates.orchard = Domplate.domplate({
    tag: 
      dp.DIV({'class':'selectedOrchard'},
         dp.TAG(OrchardView.projects.tag, {orchardModel: '$orchardModel'})
      )
  });
        
  templates.overview = Domplate.domplate({
      tag: 
        dp.DIV({'class':'opView'},
          dp.SPAN({'class':'pageTitle textAnnotate'}, "Orchard Project Manager"),
          dp.TAG(templates.orchardSelector.tag, {orchardManager: '$orchardManager'})
        ),
        
      getSelectedOrchardText: function(selectedOrchardName) {
        return selectedOrchardName || 'No orchards defined';
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
  
  var opm = {
    
    render: function(connection) {
      console.log("render", connection);
      this.connection = connection; 
      var orchardNames = Object.keys(this.orchardModels);
      var selectedName = this.getSelectedOrchardName();
      var overview = templates.overview.tag.append(
        {orchardManager: this, selectedOrchardName: selectedName}, 
        window.document.body
      );
      if (!selectedName) {
        window.setTimeout(function() {
          var adder = overview.querySelector('.orchardSelector');
          click(adder);
        });
      } else {
        var selectedOrchard = this.orchardModels[selectedName];
        templates.orchardSelector.selectOrchard(selectedOrchard);
      }
    },
    
    getOrchardNames: function() {
      return Object.keys(this.orchardModels);
    },
    
    getSelectedOrchardName: function() {
      var names = this.getOrchardNames();
      if (names.length) {
        return names[names.length - 1];
      } else {
        return '';
      }
    },
    
    getCreateSiteURL: function() {
      return '/site';
    },
    
    buildOrchardModels: function(thenCall) {
      connection.load(function() {
        this.orchardModels = {};
        connection.getSiteNames().forEach(function(siteName) {
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