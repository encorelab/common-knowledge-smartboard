CommonBoard = {
    rollcallURL: '/rollcall',
    
    events: {
        sail: {
            ck_new_note: function(sev) {
                note = {
                    content: sev.payload.content,
                    pos: sev.payload.pos,
                    author: sev.origin,
                    timestamp: sev.timestamp,
                    id: sev.payload.id
                }
                CommonBoard.createNoteBalloon(note)
                CommonBoard.updateKeywordsWithNewNote(note)
            },
        },
        
        initialized: function(ev) {
            Sail.app.authenticate()
        },
        
        connected: function(ev) {
        },
        
        authenticated: function(ev) {
            $('#connecting').hide()
        },
        
        unauthenticated: function(ev) {
            Rollcall.Authenticator.requestRun()
        }
    },
    
    init: function() {
        Sail.app.rollcall = new Rollcall.Client(Sail.app.rollcallURL)
        
        Sail.app.run = JSON.parse($.cookie('run'))
        if (Sail.app.run) {
            Sail.app.groupchatRoom = Sail.app.run.name+'@conference.'+Sail.app.xmppDomain
        }
        
        Sail.modules
            .load('Rollcall.Authenticator', {mode: 'picker', askForRun: true, curnit: 'WallCology', userFilter: function(u) {return u.kind == "Instructor"}})
            .load('Strophe.AutoConnector')
            .load('AuthStatusWidget')
            .thenRun(function () {
                Sail.autobindEvents(CommonBoard)
                
                $(document).ready(function() {
                    $('#reload').click(function() {
                        Sail.Strophe.disconnect()
                        location.reload()
                    })

                    $('#connecting').show()
                    
                    $('#restore-notes').click(function() {
                        fromDate = moment().subtract('days', 14).native()
                        CommonBoard.loadNotes({"timestamp": {"$gte": fromDate.toISOString()}})
                    })
                })

                $(Sail.app).trigger('initialized')
                return true
            })
    },
    
    createNoteBalloon: function(note) {
        var balloon = $("<div class='balloon note'></div>")
        
        balloon.attr('id', "note-"+note.id)
        balloon.addClass('author-'+CommonBoard.authorToClassName(note.author))
        $(note.content.keywords).each(function() {
            balloon.addClass(CommonBoard.keywordToClassName(this))
        })

        balloon.hide() // initially hidden, we call show() with an effect later
        
        activeKeywordClasses = CommonBoard.activeKeywordClasses()
        
        // don't hide incoming balloons if no tags are active
        if (activeKeywordClasses.length > 0) {
            // check if any of this balloon's keywords are currently selected
            anyActive = _.any(activeKeywordClasses, function(klass) {
                return balloon.is('.'+klass)
            })

            if (!anyActive)
                balloon.addClass('blurred')
        }
        
        author = $("<div class='author'>")
        author.text(note.author)
        balloon.append(author)

        headline = $("<h3 class='headline'></h3>")
        headline.text(note.content.headline)
        balloon.append(headline)

        content = $("<div class='content'></div>")
        content.hide()
        
        writeup = $("<div class='writeup'></div>")
        writeup.text(note.content.writeup)
        content.append(writeup)
        
        keywords = $("<div class='keywords'></div>")
        if (note.content.keywords) {
            keywords.text(note.content.keywords.join(", "))
            content.append(keywords)
        }
        
        balloon.append(content)

        balloon.dblclick(function() {
            $(this).find('.content').toggle('fast')
        })

        // balloon.dblclick(function() {
        //     expl = $(this).find('.explanation')
        //     if ($(expl).is(':visible'))
        //         $(expl).hide('slide', {direction: 'up', duration: 'fast'})
        //     else
        //         $(expl).show('slide', {direction: 'up', duration: 'fast'})
        // })

        // bring the balloon to the top when clicked
        balloon.mousedown(function() {
            zs = $('.balloon').map(function() {z = $(this).css('z-index'); return z == 'auto' ? 100 : parseInt(z)}).toArray()
            maxZ = Math.max.apply(Math, zs)
            $(this).css('z-index', maxZ + 1)
        })

        $("#board").append(balloon)
        
        // this should happen after the balloon has been given all of its content and styling
        // so that its width and heigh can be accurately determined
        
        CommonBoard.positionNoteBalloon(note, balloon)

        balloon.draggable({
            stop: function(ev, ui) {
                CommonBoard.noteBalloonPositioned(note, ui.position)
            }
        })
        
        balloon.show('puff', 'fast')
        
        return balloon
    },
    
    positionNoteBalloon: function(note, balloon) {
        var left, top;
        
        boardWidth = $("#board").width();
        boardHeight = $("#board").height();
        
        if (note.pos && note.pos.left)
            left = note.pos.left;
        else
            left = Math.random() * (boardWidth - balloon.width());
        
        if (note.pos && note.pos.top)
            top = note.pos.top;
        else
            top = Math.random() * (boardHeight - balloon.height());
        
        balloon.css('left', left + 'px');
        balloon.css('top', top + 'px');
        
        if (note.id) {
            CommonBoard.noteBalloonPositioned(note, {left: left, top: top});
        }
    },
    
    noteBalloonPositioned: function(note, pos) {
        payload = {
            id: note.id,
            pos: pos,
        }
    
        sev = new Sail.Event('ck_position_note', payload)
	
    	Sail.app.groupchat.sendEvent(sev)  
    },
    
    keywordToClassName: function(keyword) {
        return "keyword-"+keyword.replace(/\s/,'_')
    },

    authorToClassName: function(author) {
        return "author-"+author.replace(/\s/,'_')
    },
    
    updateKeywordsWithNewNote: function(note) {
        none_yet = $('#keywords .none-yet')
        if (none_yet.length > 0)
            none_yet.remove()
        
        list = $('#keywords ul')
        _.each(note.content.keywords, function (keyword) {
            klass = CommonBoard.keywordToClassName(keyword)
            li = list.find('.'+klass)
            if (li.length == 0) {
                li = $('<li></li>')
                li.text(keyword)
                li.addClass(klass)
                li.click(function() {
                    CommonBoard.toggleKeyword(keyword)
                })
                list.append(li)
            }
        })
    },
    
    toggleKeyword: function(keyword) {
        klass = CommonBoard.keywordToClassName(keyword)
        li = $('#keywords li.'+klass)
        if (li.is('.selected')) {
            li.removeClass('selected')
            CommonBoard.filterBalloons()
        } else {
            li.addClass('selected')
            CommonBoard.filterBalloons()
        }
    },
    
    activeKeywordClasses: function() {
        return $('#keywords li.selected').map(function() {
            return _.select($(this).attr('class').split(' '), function(klass) {
                return klass.match(/keyword-/)
            })
        }).toArray()
    },
    
    inactiveKeywordClasses: function() {
        return $('#keywords li').not('.selected').map(function() {
            return _.select($(this).attr('class').split(' '), function(klass) {
                return klass.match(/keyword-/)
            })
        }).toArray()
    },
    
    filterBalloons: function() {
        activeKeywordClasses = CommonBoard.activeKeywordClasses()
        inactiveKeywordClasses = CommonBoard.inactiveKeywordClasses()
        
        if (activeKeywordClasses.length == 0) {
            // show all balloons if no filters are active
            $('.balloon').removeClass('blurred')
        } else {
            // TODO: use inactiveKeywordClasses to make this more efficient
            $('.balloon').addClass('blurred')
        
            // INTERSECTION (and)
            //$('.balloon.'+activeKeywordClasses.join(".")).removeClass('blurred')
        
            // UNION (or)
            $('.balloon.'+activeKeywordClasses.join(", .balloon.")).removeClass('blurred')
        }
    },
    
    loadNotes: function(criteria) {
        var criteria = _.extend({'run.name':Sail.app.run.name}, criteria)
        
        // FIXME: will only fetch last 100 notes... need to do a _count request first
        $.ajax({
            url: (Sail.app.mongooseURL || '/mongoose') + '/common-knowledge/notes/_find',
            data: {
                criteria: JSON.stringify(criteria),
                batch_size: 100,
                sort: JSON.stringify({"timestamp":-1})
            },
            success: function(data) {
                console.debug("Got "+data.results.length+" notes from mongoose...")
                _.each(data.results, function(note) {
                    note.id = note._id
                    if ($('#note-'+note.id).length == 0) {
                        CommonBoard.createNoteBalloon(note)
                        CommonBoard.updateKeywordsWithNewNote(note)
                    }
                })
            },
            error: function(xhr, error, ex) {
                console.error("Failed to load existing discussions: ", error, ex)
                alert("Failed to load existing discussions: "+error)
            }
        })
    },
    
    authenticate: function() {
        Sail.app.token = Sail.app.rollcall.getCurrentToken()

        Sail.app.run = Sail.app.run || JSON.parse($.cookie('run'))
        
        if (!Sail.app.run) {
            Rollcall.Authenticator.requestRun()
        } else if (!Sail.app.token) {
            Rollcall.Authenticator.requestLogin()
        } else {
            Sail.app.rollcall.fetchSessionForToken(Sail.app.token, 
                function(data) {
                    Sail.app.session = data.session
                    $(Sail.app).trigger('authenticated')
                },
                function(error) {
                    console.warn("Token '"+Sail.app.token+"' is invalid. Will try to re-authenticate...")
                    Sail.app.token = null
                    Rollcall.Authenticator.requestLogin()
                }
            )
        }
    },
    

}
