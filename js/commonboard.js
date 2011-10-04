CommonBoard = {
    rollcallURL: '/rollcall',
    xmppDomain: 'glint',
    
    events: {
        sail: {
            ck_new_note: function(sev) {
                debugger
                note = {
                    content: sev.payload,
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
            .load('Rollcall.Authenticator', {mode: 'picker', askForRun: true, curnit: 'WallCology'})
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
                })

                $(Sail.app).trigger('initialized')
                return true
            })
    },
    
    createNoteBalloon: function(note) {
        balloon = $("<div class='balloon note'></div>")

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
        keywords.text(note.content.keywords.join(", "))
        content.append(keywords)
        
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
            zs = $('.balloon').map(function() {z = $(this).css('z-index'); return z == 'auto' ? 100 : parseInt(z)})
            maxZ = Math.max.apply(Math, zs)
            $(this).css('z-index', maxZ + 1)
        })

        $("#board").append(balloon)
        
        // this should happen after the balloon has been given all of its content and styling
        // so that its width and heigh can be accurately determined
        
        boardWidth = $("#board").width()
        boardHeight = $("#board").height()
        
        x = Math.random() * (boardWidth - balloon.width())
        y = Math.random() * (boardHeight - balloon.height())
        
        balloon.css('left', x + 'px')
        balloon.css('top', y + 'px')

        balloon.draggable()
        
        balloon.show('puff', 'fast')
        
        return balloon
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
        
        // TODO: use inactiveKeywordClasses to make this more efficient
        $('.balloon').addClass('blurred')
        
        // INTERSECTION (and)
        //$('.balloon.'+activeKeywordClasses.join(".")).removeClass('blurred')
        
        // UNION (or)
        $('.balloon.'+activeKeywordClasses.join(", .balloon.")).removeClass('blurred')
    },
    
    authenticate: function() {
        Sail.app.token = Sail.app.rollcall.getCurrentToken()

        if (!Sail.app.token) {
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