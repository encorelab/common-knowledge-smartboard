CommonBoard = {
    rollcallURL: '/rollcall',
    xmppDomain: 'glint',
    
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

        balloon.attr('id', "note-"+note.content._id)
        balloon.addClass('author-'+CommonBoard.authorToClassName(note.author))
        $(note.content.keywords).each(function() {
            balloon.addClass('keyword-'+CommonBoard.keywordToClassName(this))
        })

        balloon.hide() // initially hidden, we call show() with an effect later

        headline = $("<h3 class='headline'></h3>")
        headline.text(note.content.headline)
        balloon.append(headline)

        writeup = $("<div class='writeup'></div>")
        writeup.text(note.content.writeup)
        writeup.hide()
        balloon.append(writeup)

        balloon.dblclick(function() {
            $(this).find('.writeup').toggle('fast')
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
    
    events: {
        sail: {
            ck_new_note: function(sev) {
                note = {
                    content: sev.payload,
                    author: sev.origin,
                    timestamp: sev.timestamp
                }
                CommonBoard.createNoteBalloon(note)
            }
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
    }
}