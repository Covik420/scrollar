(function($) {
    function ScrollarException(message) {
        this.message = message;
        this.name = 'ScrollarError';
        this.stack = (new Error()).stack;
        var ln = this.stack.split('\n');
        ln = ln[1];
        ln = ln.match(/:(\d+):/gi).join("");
        ln = ln.substring(1, ln.length - 1);
        if(ln) this.lineNumber = ln;
    }
    ScrollarException.prototype = new Error();

    var methods = {
      init: function(settings) {
        return this.each(function() {
           var $this = $(this),
               s = $.extend($.fn.scrollar.defaults, settings);

           if($this.outerWidth() < 70 || $this.outerHeight() < 60) return true;

           $this.scrollar = new Scrollar($this, s);
        });
      }
    };

    $.fn.scrollar = function(method) {
        if(methods[method]) return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        else if(typeof method === 'object' || !method) return methods.init.apply(this, arguments);
    };

    $.fn.scrollar.defaults = {
        axis: 'xy',
        fadeOnHover: true,
        fixedHandle: false,
        checkParentAbsolute: true,
        dragContentMobileOnly: false,
        lockAxis: false,
        primaryAxis: 'y',
        mouseWheel: 40,
		keyboardSupport: 30,
        //
        bounceEffect: true,
        mouseLock: true,
        selectionScroll: true
    };

    var Scrollar = function(container, settings) {
        var parent = this;
        this.c = container;
        this.s = settings;
        this.p = {
            directions: {
                x: false,
                y: false
            },
            hold: {
                x: false,
                y: false
            },
            handleHold: false,
            bothAxis: false,
        };
        this.axis = {};

        var axis = this.s.axis.toLowerCase(),
            directions = this.p.directions;

        if(axis.indexOf('x') > -1) directions.x = this.c[0].scrollWidth > this.c.parent().outerWidth();
        if(axis.indexOf('y') > -1) directions.y = this.c[0].scrollHeight > this.c.parent().outerHeight();

        this.p.bothAxis = directions.x && directions.y;

        if(this.p.directions.x || this.p.directions.y) {
            var wrapperClasses = '';

            if (this.s.fadeOnHover) wrapperClasses += ' scrollar-fade-hover';
            if (this.s.checkParentAbsolute && this.c.parent().css('position') == 'absolute') wrapperClasses += ' scrollar-parent-absolute';

            this.c.wrap('<div class="scrollar-content"></div>');
            this.content = this.c.parent();
            this.content.wrap('<div class="scrollar-wrapper' + wrapperClasses + '" role="scrollbar" tabindex="-1"></div>');
            this.wrapper = this.content.parent();

            $.each(this.p.directions, function (i, val) {
                if (val === true) parent.axis[i] = new ScrollarAxis(i, parent);
            });

            this.bindAllEvents();
        }
        else delete this;
    };

    Scrollar.prototype = {
        bindAllEvents: function() {
            var parent = this,
                pX = 0;

            this.bindEvent(this.wrapper, 'mousedown touchstart', function(e) {
                var contentElement = e.targetElement.closest('.scrollar-content', parent.wrapper[0]),
                    lockAxis = parent.s.lockAxis,
                    mouseDown = e.type == 'mousedown';

                if((parent.s.dragContentMobileOnly && mouseDown && contentElement.length > 0) || (e.originalEvent.changedTouches && e.originalEvent.changedTouches.length > 1)) return false;

                if(mouseDown) e.preventDefault();

                pX = e.pos.x;

                parent.p.handleHold = e.targetElement.closest('.scrollar-handle-container', parent.wrapper[0]).length > 0;

                $.each(parent.axis, function(i, val) {
                    var dir = i == 'x' ? 'left' : 'top';

                    if(lockAxis == i || lockAxis === false) parent.p.hold[i] = e.pos[i] - (parent.p.handleHold ? val.handle.handle.position()[dir] : (parent.wrapper.offset()[dir] + parent.content.position()[dir]));
                });

                /*if((lockAxis == 'x' || lockAxis === false) && parent.axis.x) parent.p.hold.x = e.pos.x - (parent.p.handleHold ? parent.axis.x.handle.handle.position().left : (parent.wrapper.offset().left + parent.content.position().left));
                if((lockAxis == 'y' || lockAxis === false) && parent.axis.y) parent.p.hold.y = e.pos.y - parent.axis.y.handle.handle.position().top;*/

                window['currentScrollarInstance'] = parent;
            });

            this.bindEvent($('body'), 'mousemove touchmove', function(e) {
                if(typeof window['currentScrollarInstance'] !== 'undefined' && window['currentScrollarInstance'] === parent && (parent.p.hold.x !== false || parent.p.hold.y !== false)) {
                    $.each(parent.p.hold, function(i, val) {
                        var dir = i == 'x' ? 'left' : 'top';
                        if(val !== false) parent.axis[i].handle.move(e.pos[i] - val - (parent.p.handleHold ? 0 : parent.wrapper.offset()[dir]), parent.p.handleHold);

                        if(i == 'x' && (Math.abs(e.pos[i] - pX) > 30)) e.preventDefault();
                    });

                    /*if(parent.p.hold.x !== false) parent.axis.x.handle.move(e.pos.x - parent.p.hold.x - (parent.p.handleHold ? 0 : parent.wrapper.offset().left), parent.p.handleHold);
                    if(parent.p.hold.y !== false) parent.axis.y.handle.move(e.pos.y - parent.p.hold.y);*/

                    parent.wrapper.attr('data-scrollar-hold', true);
                }
            });

            this.bindEvent($(document), 'mouseup touchend', function() {
                if(typeof window['currentScrollarInstance'] !== 'undefined') {
                    window['currentScrollarInstance'].p.hold = {
                        x: false,
                        y: false
                    };
                    window['currentScrollarInstance'].p.handleHold = false;
                    window['currentScrollarInstance'].wrapper.removeAttr('data-scrollar-hold');
                    delete window['currentScrollarInstance'];
                }
            });

            this.bindEvent(this.wrapper, 'mousewheel DOMMouseScroll', function(e) {
				parent.handleWheel(e);
            });
			
			this.bindEvent(this.wrapper, 'click', function() {
				parent.wrapper.focus();
			});
			
			this.bindEvent(this.wrapper, 'keydown', function(e) {
				parent.handleKeyboard(e);
			});
        },
        bindEvent: function(eventElement, eventName, eventCallback) {
            var parent = this;

            eventElement.on(eventName, function(e) {
                var event = e,
                    pos = parent._getMouse(e);
                event.pos = {
                    x: pos.x,
                    y: pos.y
                };
                event.targetElement = $(e.target) || $(e.srcElement);
				event.key = e.which || e.keyCode;

                eventCallback.call(this, event);
            });

            return this;
        },
        handleWheel: function(e) {
            var parent = this,
                mw = parent.s.mouseWheel;

            if(mw && (typeof mw === 'number' || typeof mw === 'string')) {
                e.preventDefault();

                var doWheel = function(dir) {
                    if(dir !== 'up' && dir !== 'down') throw new ScrollarException('dir must be "up" or "down"');
                    var pAxis = parent._getPrimaryAxis();

                    parent.axis[pAxis].handle.wheelMove(dir);
                };

                if(e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) doWheel('up');
                else doWheel('down');
            }

            return this;
        },
        handleKeyboard: function(event) {
            var kb = this.s.keyboardIncrement;
            if(kb == false && (typeof kb !== 'number' || typeof kb !== 'string')) return this;

            var parent = this,
                key = event.key,
                keyMap = {
                  x: [37, 39],
                  y: [38, 40]
                },
                gotAxis = false,
                gotAction = false;

            $.each(keyMap, function(i, val) {
                var directionIndex = $.inArray(key, val);
                if(directionIndex >= 0 && parent.axis[i]) {
                    gotAxis = i;
                    gotAction = directionIndex == 0 ? 'd' : 'i'; //d: decrement (top/left) i: increment (bottom/right)
                    return false;
                }
            });

            if(!gotAxis || !gotAction) return this;

            e.preventDefault();

            this.axis[gotAxis].handle.keyboardMove(gotAction);

            return this;
        },
        _getPrimaryAxis: function() {
            var pAxis = this.s.primaryAxis;

            if(pAxis === 'x' && typeof this.axis.x == 'undefined') pAxis = 'y';
            else if(pAxis === 'y' && typeof this.axis.y == 'undefined') pAxis = 'x';

            return pAxis;
        },
        _getMouse: function(e) {
            var touch = e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0];
            e = touch || e;

            return {
                x: e.pageX,
                y: e.pageY
            };
        }
    };

    var ScrollarAxis = function(axis, parent) {
        this._parent = parent;
        this.axis = axis;
        this.container = $('<div />', {class: 'scrollar-axis scrollar-axis-'+ axis + (parent.p.bothAxis ? ' scrollar-both-axis' : '')})
                       .appendTo(parent.wrapper);

        this.handle = new ScrollarHandle(this);
    };

    var ScrollarHandle = function(parent) {
        this._axis = parent;
        this.container = $('<div />', {class: 'scrollar-handle-container'})
            .appendTo(parent.container);

        this.handle = $('<div />', {class: 'scrollar-handle'})
                      .appendTo(this.container);

        this.setSize();
    };

    ScrollarHandle.prototype = {
        setSize: function() {
            var parent = this._axis,
                main = parent._parent;

            var lengths = this._getLengths(),
                contentSize = lengths[0],
                contentLength = lengths[1],
                handleContainerSize = lengths[2],
                handleSize = Math.max(Math.ceil(
                    (contentSize * handleContainerSize / contentLength)
                ), 20),
                propertyType = parent.axis == 'x' ? 'width' : 'height';

            if(main.s.fixedHandle && main.s.fixedHandle > 20) handleSize = main.s.fixedHandle;

            handleSize = handleSize / handleContainerSize * 100;

            this.handle.css(propertyType, handleSize + '%');

            this.setRatio();

            return this;
        },
        setRatio: function() {
            var lengths = this._getLengths(),
                contentSize = lengths[0],
                contentLength = lengths[1],
                handleContainerSize = lengths[2],
                handleSize = lengths[3];

            this.ratio = (contentLength - contentSize) / (handleContainerSize - handleSize);
            this.handleRatio = (handleContainerSize - handleSize) / (contentLength - contentSize);

            return this;
        },
        move: function(value, handleHold) {
            var main = this._axis._parent,
                axis = this._axis.axis,
                lengths = this._getLengths(),
                handleContainerSize = lengths[2],
                handleSize = lengths[3],
                orientation = (axis == 'x' ? 'left' : 'top'),
                minValue = 0,
                maxValue = handleContainerSize,
                handleValue,
                contentValue;


                /*minValue -= main.p.bounceValue;
                maxValue += main.p.bounceValue;*/

            /*if(value < minValue) value = minValue;
            if(value + handleSize > maxValue) {
                if(main.s.bounceEffect) {
                    ratio = main.p.lastBounceIncrement - (this.ratio * 0.01);
                    main.p.lastBounceIncrement = ratio;
                    console.log(ratio);
                }
                else
                value = maxValue - handleSize;
            }*/

            if(!handleHold) {
                var val = Math.abs(value);

                if (value > minValue) value = minValue;
                else if (val + lengths[0] > lengths[1]) value = -1 * lengths[1] + lengths[0];

                value = value / (lengths[0]) * 100;

                handleValue = -1 * value * this.handleRatio;
                contentValue = value;
            }
            else {
                if(value < minValue) value = minValue;
                else if(value + handleSize > maxValue) value = maxValue - handleSize;

                value = value / handleContainerSize * 100;
                handleValue = value;
                contentValue = -1 * value * this.ratio;
            }

            this.handle.css(orientation, handleValue + '%');
            main.content.css(orientation, contentValue + '%');

            return this;
        },
        wheelMove: function(dir) {
            if(dir !== 'up' && dir !== 'down') throw new ScrollarException('dir should be "up" or "down"');

            var lengths = this._getLengths(),
                mouseWheel = this._getSpecialValue("mouseWheel"),
                value = lengths[4];

            if(dir === 'up') value -= mouseWheel;
            else value += mouseWheel;

            this.move(value, true);

            return this;
        },
        keyboardMove: function(action) {
            if(action != 'd' && action != 'i') throw new ScrollarException('action for »keyboardMove« must be "d" or "i"');

            var lengths = this._getLengths(),
                keyboardIncrement = this._getSpecialValue("keyboardIncrement"),
                value = lengths[4];

            if(action === 'd') value -= keyboardIncrement;
            else value += keyboardIncrement;

            this.move(value, true);
        },
        _getSpecialValue: function(property) {
            var lengths = this._getLengths();

            switch(property) {
                case "mouseWheel":
                case "keyboard":
                break;

                default:
                    throw new ScrollarException('property is not valid');
                break;
            }

            property = this._axis._parent.s[property];

            if(typeof property == 'string' && property.substring(property.length - 1) == '%') {
                var val = parseInt(property.substring(0, property.length - 1), 10);

                if(val < 1 || val > 50) property = 40;
                else property = lengths[1] * (val / 100);
            }
            else if(typeof property == 'number') {
                if(property < 1 || property >= lengths[1]) property = 40;
            }
            else throw new ScrollarException('mouseWheel must be integer or string (percentage)');

            return property;
        },
        _getLengths: function() {
            var parent = this._axis,
                main = this._axis._parent,
                isX = parent.axis == 'x';

            return [
                isX ? main.wrapper.outerWidth() : main.wrapper.outerHeight(),
                isX ? main.c[0].scrollWidth : main.c[0].scrollHeight,
                isX ? this.container.outerWidth() : this.container.outerHeight(),
                isX ? this.handle.outerWidth() : this.handle.outerHeight(),
                parseInt(this.handle.css(isX ? 'left' : 'top'), 10)
            ];
        }
    };
}) (jQuery);