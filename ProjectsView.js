// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject','opm/Connection'], 
function(                 Domplate,             MetaObject,      connection) {


  function getAncestorByClassName(elt, className) {
    var parent = elt.parentElement;
    while(parent) {
      if (parent.classList.contains(className)) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }
  
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
  
  var updateQueue = [];
  var hasFocus = true;
  window.addEventListener('focus', function() {
    if (!hasFocus) {
      hasFocus = true;
      updateQueue.forEach(function(update) {
        update();
      });
    }
    document.title = 'grove';
  });

  window.addEventListener('blur', function() {
    document.title = 'grove: watching';
    hasFocus = false;
  });
  
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
        if (names.indexOf(name) === -1) { // not managed
          var project = projectsByName[name];
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
        projects: managed,
      }, body);
      templates.addMore.tag.append({
        projects: unmanaged,
        siteModel: this.siteModel
      }, body);
    }
  });

  with (Domplate.tags) {

    var templates = {};
    
    templates.common = Domplate.domplate({
    
      getElement: function(project) {
        if (project.element) {
          if (project.element.parentNode) {
            return project.element; 
          }
        }
        var projectElements = document.querySelectorAll('.managedProject');
        for (var i = 0; i < projectElements.length; i++) {
          var projectElement = projectElements[i];
          if (projectElement.project == project) {
            return project.element = projectElement;
          }
        };
      },
      
      getName: function(project) {
        return project.Name;
      },
      
      getCellContent: function(project) {
        this.update(project);
        return 'updating';
      },

      pollOrion: function(project, progress, complete, taskObj) {
        if (taskObj.Running) {
          progress.apply(this, [taskObj]);
          window.setTimeout(function repoll(){
            connection.getObject(taskObj.Location, 
            this.pollOrion.bind(this, project, progress, complete),
            this.updateFailed.bind(this, project) );
          }.bind(this), 200);  
        } else {
          complete.apply(this, [taskObj]);
        }
      },

      warn: 'gitWarn',
      err: 'gitError',
      ok:  'gitOk',
    });
    
    templates.message = Domplate.domplate(templates.common, {
      tag: 
        DIV({'class':'overlay message', 'onclick':'$message|getClickAction'}, 
          DIV({'class':'whileTrying'}, "$message|getOperation"),
          DIV({'class':'serverMessage'}, "$message|getServerMessage"),
          DIV({'class':'serverDetails'}, "$message|getServerDetails"),
          DIV({'class':'centerButton'},
             BUTTON({'class':'okButton'}, 'Ok')
          )
        ),
      getOperation: function(msg) {
        return msg.operation || '';
      },
      getServerMessage: function(msg) {
        return msg.Message || msg;
      },
      getServerDetails: function(msg) {
        return msg.DetailedMessage || '';
      },
      getCloser: function(overlay) {
        return function() {
          if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
          } // else not in the doc any longer
        }
      },
      getClickAction: function() {
        return function() {
          var elt = document.querySelector('.message');
          var closer = this.getCloser(elt);
          closer.call();
        }
      }
    });
    
    templates.column = Domplate.domplate(templates.common, {

      getElementId: function(project) {
        return this.getColumnName() + '_' + project.Name;
      },
      
      updateFailed: function(project, err) {
        console.error("Update "+this.getColumnName()+" on "+project.Name+" FAILED "+err, err.stack);
        return err;
      },
    });
    
    templates.projectName = Domplate.domplate(templates.column, {
      tag: SPAN({
                  'id':'$project|getElementId', 
                  'class':'projectName columnCell columnLink',  
                  'title':'$project|getTitle', 
                  'onclick':"$project|getColumnAction" 
                }, "$project|getName"),
      getColumnName: function() {
        return 'name'
      },
      getTitle: function() {
        return "Open in Orion Navigator";
      },
      getColumnAction: function(project) {
        return function(event) {
          var splits = project.ContentLocation.split('/');
          var url = splits.slice(0,3).join('/')+'/navigate/table.html#/'+splits.slice(3).join('/')+"?depth=1";
          window.open(url);
          // When the user comes back to this tab, update this project view
          updateQueue.push(templates.project.update.bind(templates.project, project));
        }
      }
    });

    templates.status = Domplate.domplate(templates.column, {
      tag: A({'id':'$project|getElementId', 'class':"columnLink columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
         ),

      getColumnName: function() {
        return 'status';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          var status = event.currentTarget.getAttribute('gitStatus');
          if (project.onBranch.name === 'master' && status !== this.ok) {
            if ( window.confirm("On branch master. Change branch before commit?") ) {
              var row = event.currentTarget.parentElement;
              var branchElt = row.getElementsByClassName('branch')[0];
              click(branchElt);
              return;
            }
          }
          var gitapi = project.StatusLocation.indexOf('/gitapi/');
          if (gitapi !== -1) {
            // eg http://localhost:8080/git/git-status.html#/gitapi/status/file/E/
            var statusURL = project.StatusLocation.substr(0, gitapi);
            statusURL += '/git/git-status.html#';
            statusURL += project.StatusLocation.substr(gitapi);
            window.open(statusURL);
            // When the user comes back to this tab, update this project view
            updateQueue.push(templates.project.update.bind(templates.project, project));
          } else {
            console.error("Malformed StatusLocation for "+project.Name, project);
          }
        }
      },
      
      update: function(project) {
        connection.getObject(project.StatusLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      symbolic: function(symbol, jsonObj, field) {
        var length = jsonObj[field].length;
        return (length ? symbol + length : ''); 
      },
      
      setCodeIf: function(status, code) {
        if(status) {
          this.code = code;
        }
        return status;
      },
      
      renderUpdate: function(project, jsonObj) {
        var status = "";
        status += this.setCodeIf(this.symbolic('+', jsonObj, 'Added'), this.warn);
        status += this.setCodeIf(this.symbolic('&Delta;', jsonObj, 'Modified'), this.warn);
        status += this.setCodeIf(this.symbolic('?', jsonObj, 'Changed'), this.err);
        status += this.setCodeIf(this.symbolic('X', jsonObj, 'Conflicting'), this.err);
        status += this.setCodeIf(this.symbolic('-', jsonObj, 'Missing'), this.err);
        if (!status) {
          status = "up to date";
          this.setCodeIf("up to date", this.ok);
        }
        var elt = document.getElementById(this.getElementId(project));
        elt.innerHTML = status;
        elt.setAttribute('gitStatus', this.code);
      },

    });
    
    templates.branches = Domplate.domplate(templates.common, {
      tag: DIV({'class': 'branches'},
             DIV({'class':'branchesContainer', 'onkeydown':"$project|getKeyDownAction"},
               FOR("branch", "$branches", 
                 DIV({'onclick':"$project|getClickAction"},
                   INPUT({'type':'checkbox', 'checkMe':"$branch|getSelected" }),
                   SPAN({'class':'branchName'}, "$branch|getBranchName")
                 )
              ),
              DIV({'class':'input' },
                 INPUT({'class':'newBranchName', 'type':'text'}),
                 SPAN({'class':'branchFrom branchName branchStartPoint'}, "set by setStartPoint")
               ),
             DIV({'class':'hint'}, "$project|getHint") 
         )
      ),
      
      getBranchName: function(branch) {
        return branch.name;
      },
      
      setStartPoint: function(project, branchName, countBackwards) {
        var branchFrom = document.querySelector('.branches').getElementsByClassName('branchFrom')[0];
        var head = ' HEAD';
        if (countBackwards) {
           head += '&#126;'+countBackwards;
        }
        branchFrom.innerHTML = branchName + head;
      },
      
      setSelectedCheckbox: function(branch) {
        var selectedElement = document.querySelector('.branches').querySelector('[checkMe=\'true\']');
        selectedElement.setAttribute('checked', 'checked');
      },
      
      getSelected: function(branch) {
        if (branch.selected) {
          branch.startPoint = "HEAD";  // default to HEAD on current branch
          window.setTimeout( function() {
              this.setStartPoint(branch.project, branch.name, 0);
              this.setSelectedCheckbox(branch);
            }.bind(this)
          );
        }
        return (branch.selected ? 'true' : 'false');
      },
      
      getClickAction: function(project) {
        return function(event) {
          var elt = event.currentTarget;
          var branchName = elt.getElementsByClassName('branchName')[0].textContent;
          this.checkoutBranch(project, branchName);
        }.bind(this);
      },
      
      getKeyDownAction: function(project) {
        return function(event) {
          if (event.which === 13) {  // enter
            var name = event.target.value;
            if (name) {
              connection.postObject(project.BranchLocation, {Name: name}, 
                this.checkoutBranch.bind(this, project, name),
                this.updateFailed.bind(this, project, name)
              );
              this.closeOverlay(event.currentTarget);
            } // else do nothing
          }
        }.bind(this);
      },
      
      updateFailed: function(project, name, status, jsonObj) {
        console.error("branch \'"+name+"\' operation failed "+status, jsonObj);
        jsonObj.operation = 'branch \''+name+'\' operation:';
        var row = this.getElement(project);
        var overlay = templates.message.tag.insertAfter({message: jsonObj}, row);
        // move the overlay on below of the current project
        overlay.style.top = (row.offsetTop + row.offsetHeight) +'px';
        grabClicks(templates.message.getCloser(overlay));
      },
      
      checkoutBranch: function(project, name) {
        connection.putObject(project.Location, {Branch: name}, 
          templates.branch.update.bind(templates.branch, project), 
          this.updateFailed.bind(this, project, name)
        );          
      },
      
      closeOverlay: function(childElt) { 
        if (childElt.classList.contains('branches') ) {
          var overlay = childElt;
        } else {
          var overlay = getAncestorByClassName(childElt, 'branches');
        }
        overlay.parentElement.removeChild(overlay);
      },
      
      renderUpdate: function(project, branches, elt) {
        var row = elt.parentElement;
        var overlay = this.tag.append({project: project, branches: branches}, row.parentElement);
        // move the overlay on top of the current project
        overlay.style.top = (elt.offsetTop) +'px';
        // move the container over the project's current branch name
        var branchName = row.getElementsByClassName('branchName')[0];
        overlay.style.left = branchName.offsetLeft + 'px';
        overlay.getElementsByClassName('newBranchName')[0].focus();
        window.setTimeout( function() {
          // after the overlay comes up, watch for closing signs
          grabClicks(this.closeOverlay.bind(this, overlay));
        }.bind(this));
      },
      getHint: function () {
        return "Click: checkout; arrows: change startpoint";
      },
    });
    
    templates.branch = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: DIV({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnLink  columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
             INPUT({'class':'checkboxSpacer', 'type':'checkbox', 'checked':'checked'}),
             SPAN({'class':'branchName'}, "$project|getCellContent"),
             INPUT({'class':'checkboxSpacer', 'type':'checkbox', 'checked':'checked'})
         ),
      getColumnName: function() {
        return 'branch';
      },
      getTitle: function(project) {
        return "Checkout or create branches";
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          var elt = document.getElementById(this.getElementId(project));
          var branches = project.branches;
          if (branches) {
            templates.branches.renderUpdate(project, branches, elt);
          }
        }
      },
      
      update: function(project) {
        connection.getObject(project.BranchLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      renderUpdate: function(project, jsonObj) {
        var elt = document.getElementById(this.getElementId(project));
        var branchName = elt.getElementsByClassName('branchName')[0];
        var branches = [];
        jsonObj.Children.forEach(function(child) {
          var remotes = child.RemoteLocation.map(function(remote){
            var trackingBranch = remote.Children.map(function(remoteBranch) {
              return (remoteBranch.Type === "RemoteTrackingBranch") ? remoteBranch.Name : "";
            });
            return {name: trackingBranch.join(" "), gitURL: remote.GitUrl};
          });
          var branch = {project: project, name: child.Name, selected: child.Current, remotes: remotes};
          branches.push(branch);
          if (child.Current) {
            branchName.innerHTML = child.Name;
            project.onBranch = branch;
          }
        });
        project.branches = branches;
      },

    });

    templates.push = Domplate.domplate(templates.column, {
      tag: DIV({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
             '&#x21a6;'
         ),
      getTitle: function(project) {
        return "Push "+project.Name+" to remote";
      },
      getColumnName: function() {
        return 'push';
      },
      getColumnAction: function(project) {
        return function(event) {
          alert("TODO");
        }
      },

    });

    templates.pull = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: DIV({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
             '&#x21a4;'
         ),
      getTitle: function(project) {
        return "Pull "+project.Name+" from remote";
      },
      getColumnName: function() {
        return 'pull';
      },
      getColumnAction: function(project) {
        return function(event) {
          if (project.branches) {
            project.branches.forEach(function(branch) {
              if (branch.selected) {
                 var remotes = branch.remotes;
                 if (remotes && remotes.length === 1) {
                   var pullURL = project.Location.replace('\/remote\/', '/remote/'+remotes[0].name+'/');
                   connection.postObject(pullURL, {Pull: true},
                     this.update.bind(this, project, event.currentTarget),
                     this.updateFailed.bind(this, project)
                   );
                 }
              }
            }.bind(this));
          }
        }
      },
      update: function(project, elt, taskObj) {
        var projectElt = getAncestorByClassName(elt, 'managedProject');
        var projectWidth = projectElt.clientWidth +'px';
        var busyElt = templates.task.tag.insertAfter({project:project, taskObj: taskObj}, projectElt.previousSibling);
        busyElt.firstChild.style.width = projectWidth;

        this.pollOrion(project, function progress(taskObj) {
            busyElt.parentElement.removeChild(busyElt);
            busyElt = templates.task.tag.insertAfter({project:project, taskObj: taskObj}, projectElt.previousSibling);
            busyElt.firstChild.style.width = projectWidth;
          }, function complete(taskObj) {
            templates.project.tag.insertAfter({project: project}, projectElt);
            projectElt.parentElement.removeChild(projectElt);
            busyElt.parentElement.removeChild(busyElt);
          }, taskObj
        );
      }

    });

    templates.remote = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: A({'id':'$project|getElementId', 'class':"columnLink $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
         ),
      getColumnName: function() {
        return 'remote';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          alert("pop up a list of remotes?");
        }
      },
      
      update: function(project) {
        connection.getObject(project.BranchLocation, this.renderUpdate.bind(this, project), this.updateFailed.bind(this, project));
      },
      
      renderUpdate: function(project, jsonObj) {
        var elt = document.getElementById(this.getElementId(project));
        var branches = [];
        jsonObj.Children.forEach(function(child) {
          
          child.RemoteLocation.some(function(remote){
            return remote.Children.some(function(remoteBranch) {
              if (remoteBranch.Type === "RemoteTrackingBranch") {
                elt.innerHTML = remoteBranch.Name;
                return true;
              }
            });
          });
        });
      },

    });
    
    templates.unmanage = Domplate.domplate(templates.column, {
      tag: SPAN({'id':'$project|getElementId',  'title':'$project|getTitle','class':'unmanage columnButton columnCell', 'onclick':"$project|getColumnAction" },
        '&#x25BC;'),
      
      getColumnName: function() {
        return 'unmanage';
      },

      getTitle: function(project) {
        return "Remove "+project.Name+" from the projects managed list";
      },
      
      getColumnAction: function(project) {
        return function(event) {
          var unmanagedProjectElement = window.document.querySelector(".unmanaged");
          var siteModel = unmanagedProjectElement.siteModel;
          var row = event.target.parentElement;
          siteModel.removeProject(project).then(
            function() {
              row.classList.add('hidden');
              },
            function() {
              console.error("unmanage fails ", arguments);
            }
          ).end();
        }
      }
    });

    templates.project = Domplate.domplate({
      tag: DIV({'class': 'opmProject managedProject',  _project: '$project'},
             TAG(templates.projectName.tag, {project: "$project"}),
             TAG(templates.branch.tag, {project: "$project"}),
             TAG(templates.status.tag, {project: "$project"}),
             TAG(templates.pull.tag, {project: "$project"}),
             TAG(templates.push.tag, {project: "$project"}),
             TAG(templates.remote.tag, {project: "$project"}),
             TAG(templates.unmanage.tag, {project: "$project"})
           ),
      
      getName: function(project) {
        return project.Name;
      },
      
      update: function(project) {
        var oldElt = templates.common.getElement(project);
        this.tag.insertAfter({project: project}, oldElt);
        oldElt.parentElement.removeChild(oldElt);
      },

    });

    templates.projects = Domplate.domplate({
          tag: DIV({'id':'opProjects'},
            H2("Managed Projects"),
            DIV({'class':'opmProjectHeader'}, 
               SPAN('Project'),
               SPAN('Branch'),
               SPAN('git Status'),
               SPAN('Pull'),
               SPAN('Push'),
               SPAN('Remote'),
               SPAN('')
            ),               
            FOR('project', '$projects',
              TAG(templates.project.tag, {project: '$project'})
            )
          ),
        });
    
    templates.task = Domplate.domplate({
      // sits in project element spot
      tag:DIV({'class': 'opmProject managedProject'},
            DIV({'class': 'overlay taskBusy'},
              TAG(templates.projectName.tag, {project: "$project"}),
              SPAN({'class':'taskMessage'}, "$taskObj|getMessage")  // TODO cancel if canBeCancelled
            )
          ),
      getName: function(project) {
        return project.Name;
      },
      getMessage: function(taskObj) {
        return taskObj.Message + taskObj.PercentComplete +"%";
      }

    });
    

        
    templates.overview = Domplate.domplate({
          tag: DIV({'id':'opView'},
            H1("Git Project Manager"),
            TAG(templates.projects.tag, {projects: "$projects"})
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
            var projects = document.querySelector('#opProjects');
            templates.project.tag.append({project: project}, projects);
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