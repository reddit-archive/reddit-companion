var port, shineBar, id, isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor), isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor)
function once(el, ev, handler, capture) {
  el.addEventListener(ev, function() {
    handler.apply(this, arguments)
    el.removeEventListener(ev, arguments.callee, capture)
  }, capture)
}

function ShineOverlay(id) {
  this.id = id
  this._id = '_shine-overlay-'+this.id
  this.init()
}
ShineOverlay.prototype = {
  init: function() {
    this.frame = document.createElement('iframe')
    this.frame.setAttribute('scrolling', 'no')
    this.frame.setAttribute('frameborder', 'no')
    this.stylesheet = document.createElement('link')
    this.stylesheet.setAttribute('href', getURL('pageOverlay.css'))
    this.stylesheet.setAttribute('type', 'text/css')
    this.stylesheet.setAttribute('rel', 'stylesheet')
    this.overlay = document.createElement('shinebar')
    this.overlay.appendChild(this.stylesheet)
    this.overlay.appendChild(this.frame)
    document.documentElement.appendChild(this.overlay)
  },
  
  setHeight: function(height) {
    if (height) {
      this.overlay.style.height = height
    }
    document.documentElement.style.marginTop = height
    this.overlay.style.opacity = height ? 1 : 0
  },

  remove: function() {
    once(document.documentElement, 'webkitTransitionEnd', function() {
      this.overlay.parentNode.removeChild(this.overlay)
    }.bind(this))
    this.setHeight(0)
  },
  
  _display: function(url) {
    this.frame.setAttribute('src', getURL(url))
  },

  display: function(fullname) {
    if (!this.fullname || this.fullname == fullname) {
      this.fullname = fullname
      if(isChrome){
        this._display('bar-chrome.html#'+encodeURIComponent(fullname))
      }
      if(isSafari){
        this._display('bar-safari.html#'+encodeURIComponent(id)+"&"+encodeURIComponent(fullname))
      }
      
    }
  },

  showSubmit: function() {
    if(isChrome){
      this._display('submit-chrome.html#'+encodeURIComponent(window.location.href))
    }
    if(isSafari){
      this._display('submit-safari.html#'+encodeURIComponent(window.location.href))
    }
    
  }
}

var shineBar
function createBar() {
  if (!shineBar) {
    shineBar = new ShineOverlay('bar')
    console.log('Shine bar created.')
  }
  return shineBar
}

function removeBar() {
  if (shineBar) {
    shineBar.remove()
    shineBar = false
    console.log('Shine bar removed.')
  }
}

function getURL(url){
  if(isChrome)
    return chrome.extension.getURL(url);
  if(isSafari)
    return safari.extension.baseURI + url;
  return null;
}

window.addEventListener('message', function(e) {
  if (originFromExtension(e.origin)) {
    if (!shineBar) { return }
    var request = JSON.parse(e.data)
    console.log('Message received from bar iframe: ', request)
    switch (request.action) {
      case 'height':
        shineBar.setHeight(request.height + 'px')
        break
      case 'close':
        removeBar()
        break
    }
  }
}, false)

function originFromExtension(origin){
  if(isChrome){
    return origin == chrome.extension.getURL('').slice(0, -1);
  }
  if(isSafari){
    return (safari.extension.baseURI.toUpperCase().indexOf(origin.toUpperCase())>=0);
  }
  return false;
}

if(isChrome){
  console.log("Chrome shine page overlay loaded");
  port = chrome.extension.connect({name:'overlay'})
  port.onMessage.addListener(function(request) {
    switch (request.action) {
      case 'showInfo':
        console.log('Shine showInfo received:', request.fullname)
        createBar().display(request.fullname)
        break
      case 'showSubmit':
        createBar().showSubmit()
        break
    }
  })

  // Remove any open bars when the extension gets unloaded.
  port.onDisconnect.addListener(function() {
    removeBar()
  })
}

if(isSafari){
  if(window.top === window){
    DEBUG = false
    if (!DEBUG) {
      console.log = function(){}
    }
    console.log("Safari shine page overlay loaded.");
    safari.self.addEventListener("message",function(messageEvent) {
    var result = messageEvent.message;
    //console.log("Received message",messageEvent);
      switch (messageEvent.name) {
        case 'showInfo':
            if(!id)
              id = result.id;
            info = result.info;
            createBar().display(info.name);
          break;
        case 'showSubmit':
          if(!id)
              id = result.id;
          createBar().showSubmit()
          break
      }
    },false);
    safari.self.tab.dispatchMessage("connect",{url:window.location.href});
  }

}
