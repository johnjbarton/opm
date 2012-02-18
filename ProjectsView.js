// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject','opm/Connection'], 
function(                 Domplate,             MetaObject,      connection) {



  var ProjectsView = MetaObject.extend({
    
    initialize: function(projectsModel, siteModel) {
      this.projectsModel = projectsModel;
      this.siteModel = siteModel;
    },
    
    getManagedProjects: function() {
      var names = this.siteModel.getManagedProjectLocations();
      return names.map(function(name) {
        return this.projectsModel.projects[name];
      }.bind(this));
    },
    
    getUnmanagedProjects: function() {
      var locations = this.siteModel.getManagedProjectLocations();
      var projectsByName = this.projectsModel.projects;
      var unmanaged = [];
      Object.keys(projectsByName).forEach(function(location) {
        if (locations.indexOf(location) === -1) { // not managed
          var project = projectsByName[location];
          unmanaged.push(project);
        }
      });
      return unmanaged;
    },
    
    render: function() {
      this._renderDomplate(this.getManagedProjects(), this.getUnmanagedProjects());
    },
    
    _renderDomplate: function(managed, unmanaged) {
      var body = window.document.body;
      templates.overview.tag.append({
        object: managed
      }, body);
      templates.addMore.tag.append({
        projects:unmanaged,
        siteModel: this.siteModel
      }, body);
    }
  });

  with (Domplate.tags) {

    var templates = {};
    
    templates.column = Domplate.domplate({
      getElementId: function(project) {
        return this.getColumnName() + '_' + project.Name;
      },
      getName: function(project) {
        return project.Name;
      },
      getCellContent: function(project) {
        this.update(project);
        return 'updating';
      },
      updateFailed: function(project, err) {
        console.error("Update "+this.getColumnName()+" on "+project.Name+" FAILED "+err, err);
        return err;
      },
    });
    
    templates.status = Domplate.domplate(templates.column, {
      tag: SPAN({'id':'$project|getElementId', 'class':"$getColumnName"}, "$project|getCellContent"),
      
      getColumnName: function() {
        return 'status';
      },
      
      update: function(project) {
        connection.getObject(project.StatusLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      symbolic: function(symbol, jsonObj, field) {
        var length = jsonObj[field].length;
        return (length ? symbol + length : ''); 
      },
      
      renderUpdate: function(project, jsonObj) {
        var status = "";
        status += this.symbolic('+', jsonObj, 'Added');
        status += this.symbolic('?', jsonObj, 'Changed');
        status += this.symbolic('X', jsonObj, 'Conflicting');
        status += this.symbolic('-', jsonObj, 'Missing');
        status += this.symbolic('&Delta;', jsonObj, 'Modified');
        if (!status) {
         status = "up to date";
        }
        document.getElementById(this.getElementId(project)).innerHTML = status;
      },

    });
    
    templates.project = Domplate.domplate({
      tag: DIV({'class': 'opmProject opmManagedProject'},
             SPAN({object: '$project'}, "$project|getName"),
             TAG(templates.status.tag, {project: "$project"}),
             SPAN('Push'),
             SPAN('Branch'),
             SPAN('Merge'),
             SPAN('Remote'),
             SPAN('Pull'),
             SPAN('&#x25BC;') // Unmanage
           ),
      getName: function(project) {
        return project.Name;
      },

    });

    templates.projects = Domplate.domplate({
          tag: DIV({'id':'opProjects'},
            H2("Managed Projects"),
            DIV({'class':'opmProjectHeader'}, 
               SPAN('Project'),
               SPAN('git Status'),
               SPAN('Push'),
               SPAN('Branch'),
               SPAN('Merge'),
               SPAN('Remote'),
               SPAN('Pull'),
               SPAN('Unmanage')
            ),               
            FOR('project', '$projects',
              TAG(templates.project.tag, {project: '$project'})
            ),
            DIV({'class':'opmProjectFooter'},
              SPAN('Update All'),
              SPAN({'id': 'gitStatusUpdateAll'}),
              SPAN({'id': 'gitPushUpdateAll'}),
              SPAN({'id': 'gitBranchUpdateAll'}),
              SPAN({'id': 'gitMergeUpdateAll'}),
              SPAN({'id': 'gitRemoteUpdateAll'}),
              SPAN({'id': 'gitPullUpdateAll'})
            )
          ),
        });
        
    templates.overview = Domplate.domplate({
          tag: DIV({'id':'opView'},
            H1("Git Project Manager"),
            TAG(templates.projects.tag, {projects: "$object"})
          ),
        });
    // http://stackoverflow.com/questions/2701192/html-is-there-an-ascii-character-for-a-up-down-triangle-arrow
    templates.addMore = Domplate.domplate({
      tag: DIV({'id': 'addMore','onkeydown': '$installIfEnter'},
           H2("Manage More Projects"),
           FOR('project', '$projects', 
              DIV({'class': 'opmProject unmanaged', _siteModel: '$siteModel'},
                SPAN({'class':'arrow-box', 'onclick': '$addProject', 'title': "$project|getTooltip"},
                  SPAN({'class':'unicode-arrow-up'}, '&#x25B2;')
                ),
                SPAN({'class': 'projectName', _repObject: '$project'}, "$project|getName")
              )
            )
          ),
      getName: function(project) {
        return project.Name;
      },
      getTooltip: function(project) {
        return "Add project\'"+project.Name + "\' to managed projects";
      },
      addProject: function(event) {
        var projectElement = event.target.parentElement.nextElementSibling;
        var projectName = projectElement.innerText;
        console.log("adding "+projectName);
        var project = projectElement.repObject;
        var siteElement = projectElement.parentElement;
        var siteModel = siteElement.siteModel;
        siteModel.addProject(project).then(
          function afterAddProject(event) {
            siteElement.classList.add('hidden');
            var footer = document.querySelector('.opmProjectFooter');
            templates.project.tag.insertAfter({project: project}, footer.previousElementSibling);
          },
          function errorAddProject(event) {
            console.error(event);
          }
        );
      },
      installIfEnter: function(event) {
        if (event.which === 13) {
          this.installProject(event);
        }
      },
    });
  }


  return ProjectsView;
});