var port, shineBar

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
    this.frame.setAttribute('style', 'width:100%; height:100%; border:none; display:block !important; left:0; overflow:hidden;')
    this.frame.setAttribute('scrolling', 'no')
    this.frame.setAttribute('frameborder', 'no')
    this.overlay = document.createElement('shinebar')
    this.overlay.setAttribute('style', 'position:fixed; top:0; left:0; right:0; height:0; display:block; height:30px; background:-webkit-linear-gradient(90deg, rgba(222,222,222,.93), rgba(245,245,245,.93)); border-bottom:1px solid #777; box-shadow:0 2px 1px rgba(100,100,100,.25); z-index:2147483647; overflow:hidden;')
    this.overlay.appendChild(this.frame)
    // document.documentElement.appendChild(this.overlay)
    document.documentElement.insertBefore(this.overlay, document.documentElement.firstChild)
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
    this.frame.setAttribute('src', chrome.extension.getURL(url))
  },

  display: function(fullname) {
    if (!this.fullname || this.fullname == fullname) {
      this.fullname = fullname
      this._display('bar.html#'+encodeURIComponent(fullname))
    }
  },

  showSubmit: function() {
    this._display('submit.html#'+encodeURIComponent(window.location.href))
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

window.addEventListener('message', function(e) {
  if (e.origin == chrome.extension.getURL('').slice(0, -1)) {
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
      case 'closeByVote':
        if (window.history.length > 1) {
          window.history.go(-1)
        } else {
          port.postMessage({action:'closeTab'})
        }
        break
    }
  }
}, false)

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

console.log('Shine page overlay loaded.')
