// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject'], 
function(    Domplate,            MetaObject) {



  var ProjectsView = MetaObject.extend({
    
    initialize: function(projectsModel) {
      this.projectsModel = projectsModel;
    },
    
    render: function() {
      this._renderDomplate(this.projectsModel);
    },
    
    _renderDomplate: function(projectsModel) {
      var body = window.document.body;
      templates.overview.tag.replace({
        object: projectsModel
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
          tag: DIV({'id':'opView','onkeydown': '$installIfEnter'},
            H1("Git Project Manager"),
            TAG(templates.projects.tag, {projects: "$object|getProjects"}),
            SPAN("HTTP Repository URL: "),
            INPUT({'id': 'newProjectURL', 'class':'inputURL','size': '80', 'type':'url', 'pattern':'http', 'value': ''}),
            SPAN({'class':'submitButton         ', 'title':'Clone this project', 'onclick':'$installProject'}, 'ok'),
            SPAN({'class':'submitButton disabled', 'title':'Cancel ', 'onclick':'$cancelInstallProject'}, 'X')
          ),
          getProjects: function(projectsModel) {
            return projectsModel.projects;
          },
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