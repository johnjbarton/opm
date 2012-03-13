// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*global define console window */

define(['lib/domplate/lib/domplate','MetaObject/MetaObject','opm/Connection', 'opm/Controls'], 
function(                 Domplate,             MetaObject,      connection,       Controls) {

  var click = Controls.click;
  var getAncestorByClassName = Controls.getAncestorByClassName;
  
  var updateQueue = [];
  var hasFocus = true;
  window.addEventListener('focus', function() {
    if (!hasFocus) {
      hasFocus = true;
      updateQueue.forEach(function(update) {
        update();
      });
    }
    document.title = 'orchard';
  });

  window.addEventListener('blur', function() {
    document.title = 'orchard: watching';
    hasFocus = false;
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
          TAG("$message|getMessageTag", {'message':'$message'}),
          DIV({'class':'centerButton'},
             BUTTON({'class':'okButton centerable', 'onclick':'$message|getOkAction'}, 'Ok')
          )
        ),
      
      getOkAction: function() {
        return function(event) {
          var overlay = Controls.getAncestorByClassName(event.currentTarget, 'overlay');
          this.getCloser(overlay).apply(this, []);
        }.bind(this);
      },
      
      getCloser: function(overlay) {
        return function() {
          if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
          } // else not in the doc any longer
        }
      },
      getClickAction: function() {
        return function(event) {
          var elt = event.currentTarget;
          if (elt.parentElement) {
            elt.parentElement.removeChild(elt);
          }
        }
      }
    });
    
    templates.serverMessage = Domplate.domplate(templates.message, {
      messageTag: DIV({'class':'serverMessage'}, 
             DIV({'class':'whileTrying'}, "$message|getOperation"),
             DIV({'class':'serverMessage'}, "$message|getServerMessage"),
             DIV({'class':'serverDetails'}, "$message|getServerDetails")
           ),
      getMessageTag: function() {
        return this.messageTag;
      },
      getOperation: function(msg) {
        return msg.operation || '';
      },
      getServerMessage: function(msg) {
        return msg.Message || msg;
      },
      getServerDetails: function(msg) {
        return msg.DetailedMessage || '';
      },
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
      tag: TD({
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

    templates.blockMasterCommit = Domplate.domplate(templates.message, {
       messageTag: DIV({'class':'blockMasterCommitMessage'}, 
             DIV({'class':'question'}, "$message.message"),
             DIV({'class':'alternative  centerButton'},
               BUTTON({'class':'alternative okButton', 'onclick':'$message.alternative.action' }, 
                 "$message.alternative.message"
               )
             )
           ),
      getMessageTag: function() {
        return this.messageTag;
      },
      getClickAction: function(message) {
        return function(event) {
          message.action.apply(this, [event]);
          var elt = document.querySelector('.message');
          if (elt) {
            var closer = this.getCloser(elt);
            closer.call();
          }
        }
      }

    });

    templates.status = Domplate.domplate(templates.column, {
      tag: TD(
             A({'id':'$project|getElementId', 'class':"columnLink columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
             )
           ),

      getColumnName: function() {
        return 'status';
      },
      
      getColumnAction: function(project) {
        return  function(event) {
          var status = event.currentTarget.getAttribute('gitStatus');
          if (project.onBranch.name === 'master' && status !== this.ok) {
            var row = event.currentTarget.parentElement;
            var branchElt = row.getElementsByClassName('branch')[0];
            templates.blockMasterCommit.tag.insertAfter({
                message: {
                  message: "On branch master. Change branch before commit?",
                  action:  click.bind(this, branchElt),
                  alternative: { 
                    message: "No, let me commit",
                    action: this.openGitStatus.bind(this, project)
                  }
                }
              }, 
            row);
          } else {
            this.openGitStatus(project);
          }
        }.bind(this);
      },
      
      openGitStatus: function(project, event) {
        var gitapi = project.StatusLocation.indexOf('/gitapi/');
        if (gitapi !== -1) {
          // eg http://localhost:8080/git/git-status.html#/gitapi/status/file/E/
          var statusURL = project.StatusLocation.substr(0, gitapi);
          statusURL += '/git/git-status.html#';
          statusURL += project.StatusLocation.substr(gitapi);
          window.open(statusURL);
          // When the user comes back to this tab, close the overlay
          var overlay = Controls.getAncestorByClassName(event.currentTarget, 'overlay');
          updateQueue.push(templates.blockMasterCommit.getCloser(overlay));
          // and update this project view
          updateQueue.push(templates.project.update.bind(templates.project, project));
          // Don't trigger the enclosing action
          event.stopPropagation();
        } else {
          console.error("Malformed StatusLocation for "+project.Name, project);
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
    
/*                     
                     TR(
                       TD({'class':'branch columnCell','onclick':"$project|getClickAction"},
                         INPUT({'type':'checkbox', 'checkMe':"$branch|getSelected" }),
                         SPAN({'class':'branchName'}, "$branch|getBranchName"),
                         INPUT({'type':'checkbox', 'class':'checkboxSpacer' })
                       )
                     )
                   )
*/

    templates.branches = Domplate.domplate(templates.common, {
      tag: DIV({'class': 'branches'},
             DIV({'class':'siteTitle'}, 
               SPAN({'class':'centerable'}, '$project|getCaption')
             ),
             DIV({'class':'branchesContainer', 'onkeydown':"$project|getKeyDownAction"},
               TABLE({'class':'commitByBranch'},
                 TBODY(
                   FOR('commit', '$project|getCommits', 
                     TR({'class':'commitRow'},
                       FOR('branchCommit', '$commit|getBranchCommit',
                         TD({'class':'branchCommit'}, '$branchCommit|getCommitInfo') 
                       )
                     )
                   )
                 )
               )
             )
          ),
      
      getCaption: function(project) {
        return project.Name;
      },
      
      getCommits: function(project) {
        return project.commits;
      },
      
      getBranchCommit: function(commit) {
        var commitMatrix = commit.project.commitMatrix;
        return Object.keys(commitMatrix).map(function(branchName) {
            return {
              name: branchName, 
              commit: commitMatrix[branchName][commit.logIndex] 
            };
        });
      },
      
      getCommitInfo: function(branchCommit) {
        var msg = branchCommit.commit ? branchCommit.commit.Message : '';
        if (msg.length > 25) {
          msg = msg.substr(0, 21) + '...';
        }
        return msg;
      },
      
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
      
      getFocusAction: function() {
        return function(event) {
          event.currentTarget.querySelector('.newBranchName').focus();
          event.stopPropagation();
        }
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
        var overlay = templates.serverMessage.tag.insertAfter({message: jsonObj}, row);
        // move the overlay on below of the current project
        overlay.style.top = (row.offsetTop + row.offsetHeight) +'px';
        Controls.grabClicks(templates.serverMessage.getCloser(overlay));
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
          var overlay = Controls.getAncestorByClassName(childElt, 'branches');
        }
        overlay.parentElement.removeChild(overlay);
      },
      
      renderUpdate: function(project, branches, elt) {
        var row = elt.parentElement;
        var projectsTable = Controls.getAncestorByClassName(row, 'projectsTable');
        var overlay = this.tag.insertAfter({project: project, branches: branches}, projectsTable);
        overlay.style.top = projectsTable.offsetTop +'px';
        // move the container over the project's current branch name
        var branch = row.querySelector('.branch');
        overlay.style.left = branch.offsetLeft + projectsTable.offsetLeft + 'px';
        // size the branch name to match the current
        var overlayBranchName = overlay.querySelector('.branch');
        overlayBranchName.style.width = branch.offsetWidth + 'px';

        // move the branch name in the overlay on top of the current project        
        var branchLog = overlay.querySelector('.branchLog');
        branchLog.style.top = elt.offsetTop +'px';
        
        overlay.style.height = projectsTable.offsetHeight +'px';
        overlay.style.width = '500px';
        
        overlay.getElementsByClassName('newBranchName')[0].focus();
        window.setTimeout( function() {
          // after the overlay comes up, watch for closing signs
          Controls.grabClicks(this.closeOverlay.bind(this, overlay));
        }.bind(this));
      },
      getHint: function () {
        return "Click: checkout; arrows: change startpoint";
      },
    });
    
    templates.branch = Domplate.domplate(templates.column, {
      // This tag is the same in all templates derived from column, but domplate inheritance fails somehow
      tag: TD({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnLink  columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
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
        this.updateCommitLog(project);
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
      
      walkParents: function(commitsById, commit, branchColumn) {
        var index = commit.logIndex;
        branchColumn[index] = commit;
        var parents = commit.Parents;
        if (parents) {
          parents.forEach(function(parent) {
            var parentCommit = commitsById[parent.Name];
            this.walkParents(commitsById, parentCommit, branchColumn);
          }.bind(this));
        }
      },
      
      buildCommitMatrix: function(project, commits) {
        project.commitMatrix = {};
        project.commits = commits;
        var commitsById = {};
        var branches = {};
        commits.forEach(function(commit, index) {
            commitsById[commit.Name] = commit;
            commit.logIndex = index;
            commit.project = project;
            if (commit.Branches) {
               commit.Branches.forEach(function(branch) {
                   if (branch.FullName.indexOf('refs/heads/') === 0) {
                     branches[branch.FullName] = index;
                   }
               });
            }
        });
        Object.keys(branches).forEach(function(branch) {
            var index = branches[branch];
            var start = commits[index];
            project.commitMatrix[branch] = [];
            this.walkParents(commitsById, start, project.commitMatrix[branch]);      
        }.bind(this));
        console.log(project.Name+' commit matrix ', project.commitMatrix);
      },
      
      updateCommitLog: function(project) {
        connection.getObject(project.HeadLocation+'?parts=log', 
            function success(jsonObj) {
              if (jsonObj.Children) {
                this.buildCommitMatrix(project, jsonObj.Children);
              }
            }.bind(this),
            function fail() {
              console.error('branch HeadLocation', arguments); 
            }
          );
      }

    });

    templates.push = Domplate.domplate(templates.column, {
      tag: TD({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
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
      tag: TD({'id':'$project|getElementId', 'title':'$project|getTitle', 'class':"columnButton columnCell $project|getColumnName", 'onclick':"$project|getColumnAction"},
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
        var projectElt = Controls.getAncestorByClassName(elt, 'managedProject');
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
      tag: TD(
             A({'id':'$project|getElementId', 'class':"columnLink $project|getColumnName", 'onclick':"$project|getColumnAction"},
              "$project|getCellContent"
             )
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
      tag: TD(
          {
            'id':'$project|getElementId',  
            'title':'$project|getTitle',
            'class':'unmanage columnButton columnCell', 
            'onclick':"$project|getColumnAction" 
          },
          '&#x21a7;'),  //http://en.wikipedia.org/wiki/Arrow_(symbol)
      
      getColumnName: function() {
        return 'unmanage';
      },

      getTitle: function(project) {
        return "Remove "+project.Name+" from the projects managed list";
      },
      
      getColumnAction: function(project) {
        return function(event) {
          var row = event.target.parentElement;
          var projectTable = Controls.getAncestorByClassName(row, 'projectsTable');
          var orchardModel = projectTable.orchardModel;
          var siteModel = orchardModel.siteModel;
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
      tag: TR({'class': 'opmProject managedProject',  _project: '$project'},
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

    templates.addMore = Domplate.domplate({
      tag: TD({'class': 'addMore', 
               'colspan':'7',
               'onclick':'$orchardModel|toggleUnmanaged', 
               _orchardModel: "$orchardModel"
             },
             DIV({'class':'siteTitle textAnnotate', 'title':'Click to open add-projects list'}, 
               A({'class':'centerable menuButton'}, "&#x21DF; add projects")
             )
           ),
      
      toggleUnmanaged: function(orchardModel) {
        return function(event) {
          var unmanagedProjects = document.querySelector('.unmanagedProjects');
          if (unmanagedProjects) {
            this.closeUnmanaged(event, unmanagedProjects);
          } else {
            this.openUnmanaged(event, orchardModel);
          }
        }.bind(this);
      },  
        
      openUnmanaged: function(event, orchardModel) {    
        var elt = event.currentTarget;
        var addButton = elt.getElementsByClassName('centerable')[0];
        var site = Controls.getAncestorByClassName(elt, 'projectsTable');
        var projectRows = site.querySelectorAll('.opmProject');
        
        var addProjectAfterRow;
        if (projectRows.length) {
          addProjectAfterRow = projectRows[projectRows.length - 1];
        } else {
          addProjectAfterRow = site.querySelector('.siteTitle');
        }
          
        var args = {orchardModel: orchardModel, addProjectAfterRow: addProjectAfterRow};
        var overlay = templates.unmanagedProjects.tag.insertAfter(args, site);
        var left = addButton.offsetLeft;
        var parent = addButton.parentElement;
        while (parent && parent !== overlay.parentElement) {
          left += parent.offsetLeft;
          parent = parent.parentElement;
        }
        overlay.style.left = left +'px';
        addButton.classList.add('menuOpen');
      },
      
      closeUnmanaged: function(event, overlay) {
        overlay.parentElement.removeChild(overlay);
        var elt = event.currentTarget;
        var addButton = elt.getElementsByClassName('centerable')[0];
        addButton.classList.remove('menuOpen');
      },
      
    });
        
     templates.unmanagedProjects = Domplate.domplate({
       tag: DIV({'class':'unmanagedProjects'},
              FOR('project', '$orchardModel|getUnmanagedProjects', 
                DIV({'class': 'opmProject unmanaged', 'onclick': '$addProjectAfterRow|getAddProject', _siteModel: '$orchardModel|getSiteModel'},
                  SPAN({'class':'arrow-box', 'title': "$project|getTooltip"},
                    SPAN({'class':'unicode-arrow-up-from-bar'}, '&#x21a5;')
                  ),
                  SPAN({'class': 'projectName', _repObject: '$project'}, "$project|getName")
                )
              )
            ),
          
      getName: function(project) {
        return project.Name;
      },
      
      getUnmanagedProjects: function(orchardModel) {
        return orchardModel.getUnmanagedProjects();
      },
      
      getSiteModel: function(orchardModel) {
        return orchardModel.siteModel;
      },
      
      getTooltip: function(project) {
        return "Add project\'"+project.Name + "\' to managed projects";
      },
      
      getAddProject: function(afterRow) {
        return this.addProject.bind(this, afterRow);
      },
      
      addProject: function(afterRow, event) {
        var projectElement = event.currentTarget.querySelector('.projectName');
        var projectName = projectElement.innerText;
        console.log("adding "+projectName);
        var project = projectElement.repObject;
        var siteElement = projectElement.parentElement;
        var siteModel = siteElement.siteModel;
        siteModel.addProject(project).then(
          function afterAddProject(event) {
            siteElement.classList.add('hidden');
            templates.project.tag.insertRows({project: project}, afterRow);
          },
          function errorAddProject(event) {
            console.error(event);
          }
        );
      },
      
      update: function(orchardModel) {
        //TODO sites
        var addMore = window.document.querySelector('.addMore');
        if (addMore) {
          if (!orchardModel) {
            orchardModel = addMore.orchardModel;
          }
          addMore.parentElement.removeChild(addMore);
        }
        this.tag.append({orchardModel: orchardModel},  window.document.body );
      }
    });


    templates.projects = Domplate.domplate({
          tag: 
            TABLE({'class':'projectsTable textAttend', _orchardModel: '$orchardModel'},
              TBODY(
                TR({'class': 'addMoreRow siteTitle textAnnotate'}, 
                  TD({'colspan':'7'},
                    A({'class':'centerable'}, "Managed Projects")
                  )
                ),
                TR({'class':'opmProjectHeader textAnnotate'}, 
                  TD('Project'),
                  TD('Branch'),
                  TD('git Status'),
                  TD('Pull'),
                  TD('Push'),
                  TD('Remote'),
                 TD('')
               ),
               FOR('project', '$orchardModel|getManagedProjects',
                 TAG(templates.project.tag, {project: '$project'})
               ),
               TR({'class': 'addMoreRow'}, 
                 TAG(templates.addMore.tag, {'orchardModel':'$orchardModel'})
               )
             )
          ),
          
          getManagedProjects: function(orchardModel) {
            return orchardModel.getManagedProjects();
          }
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
    
}

  var OrchardView = templates;
  
  return OrchardView;
});