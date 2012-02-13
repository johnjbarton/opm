// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject'], 
function(    Domplate,            MetaObject) {



  var ProjectsView = MetaObject.extend({
    
    initialize: function(projectsModel, siteModel) {
      this.projectsModel = projectsModel;
      this.siteModel = siteModel;
    },
    
    getManagedProjects: function() {
      var names = this.siteModel.getManagedProjectNames();
      return names.map(function(name) {
        return this.projectsModel.projects[name];
      }.bind(this));
    },
    
    getUnmanagedProjects: function() {
      var names = this.siteModel.getManagedProjectNames();
      var projectsByName = this.projectsModel.projects;
      var unmanaged = [];
      Object.keys(projectsByName).forEach(function(name) {
        var project = projectsByName[name];
        if (names.indexOf(project.Name) === -1) {
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
        object:unmanaged
      }, body);
    }
  });

  with (Domplate.tags) {

    var templates = {};
    templates.projects = Domplate.domplate({
          tag: DIV({'id':'opProjects'},
            H2("Projects"),
            FOR('project', '$projects', 
              DIV({'class': 'opmProject'},
                SPAN({object: '$project'}, "$project|getName")
              )
            )
          ),
          getName: function(project) {
            return project.Name;
          }
        });
    templates.overview = Domplate.domplate({
          tag: DIV({'id':'opView'},
            H1("Git Project Manager"),
            TAG(templates.projects.tag, {projects: "$object"})
          ),
        });
    templates.addMore = Domplate.domplate({
      tag: DIV({'id': 'addMore','onkeydown': '$installIfEnter'},
            SPAN("HTTP Repository URL: "),
            INPUT({'id': 'newProjectURL', 'class':'inputURL','size': '80', 'type':'url', 'pattern':'http', 'value': ''}),
            SPAN({'class':'submitButton         ', 'title':'Clone this project', 'onclick':'$installProject'}, 'ok'),
            SPAN({'class':'submitButton disabled', 'title':'Cancel ', 'onclick':'$cancelInstallProject'}, 'X')
      ),
      installProject: function(event) {
        console.log("install", event);
      },
      installIfEnter: function(event) {
        if (event.which === 13) {
          this.installProject(event);
        }
      },
      cancelInstallProject: function(event) {
      },
    });
  }


  return ProjectsView;
});