"use strict";

// Compatibility for older Firefox and Opera versions.
if (window.requestAnimationFrame === undefined) {
    window.requestAnimationFrame = function (handler) {
        return setTimeout(handler, 1000 / 60);
    }
    window.cancleAnimationFrame = function (requestId) {
        return clearTimeout(requestId);
    }
}


var gl5 = {
    FRAME_TIME_FILTER: 10,
    MOTION_BLUR_STRENGTH: 0.5,
    KEYCODE_BY_NAME: {'space': 32, 'left': 37, 'up': 38, 'right': 39,
                      'down': 40, 'esc': 27, 'enter': 13},
    NAME_BY_KEYCODE: {},

    paused: false,

    canvas: document.getElementById('canvas'),
    context: canvas.getContext('2d'),
    layers: [],
    activeLayer: null,
    imgCache: {},

    // Number of images still loading.
    nLoading: 0,
    debug: false,
    pressedKeys: {},

    // Used for FPS calculation.
    frameTime: 0,
    lastLoop: new Date,
    fps: 0,
    seconds: 0,

    mouse: null,
    screen: null,

    futureFunctions: [],

    imageCache: {},
};

gl5.loadImage = function (src, onLoad) {
    var image;
    if (gl5.imageCache[src] === undefined) {
        image = new Image();
        image.src = src;
        if (onLoad) {
            image.addEventListener('load', function () {
                onLoad(image);
            });
        }
        image.addEventListener('error', function (event) {
            console.error('Error loading image', src, event);
        });

        gl5.imageCache[src] = image;
    } else {
        image = gl5.imageCache[src];
        onLoad(image);
    }

    return image;
}

gl5.schedule = function (delay, func) {
    if (func.id !== undefined) {
        this.unregister(func);
    }
    if (delay === 0) {
        func();
        return;
    }
    this.futureFunctions.push([this.seconds + delay, func, this.activeLayer]);
}

gl5.layer = function (layer) {
    layer = layer || new Layer();
    if (this.layers.indexOf(layer) === -1) {
        var currentIndex = this.layers.indexOf(this.activeLayer);
        this.layers.splice(currentIndex + 1, 0, layer);
    }
    this.activeLayer = layer;
    return layer;
};

gl5.unlayer = function (layer) {
    if (layer !== undefined && this.layers.indexOf(layer) === -1) {
        return;
    }
    layer = layer || this.activeLayer;
    var index = this.layers.indexOf(layer)
    this.layers.splice(index, 1);
    if (layer === this.activeLayer) {
        this.activeLayer = this.layers[index - 1] || this.layers[index];
    }
    return layer;
};

gl5.unlayerAll = function () {
    this.layers = [this.layers[0]];
    this.activeLayer = this.layers[0];
}

gl5.register = function () {
    return this.activeLayer.register.apply(this.activeLayer, arguments);
};

gl5.unregister = function () {
    return this.activeLayer.unregister.apply(this.activeLayer, arguments);
};

gl5.add = function () {
    this.activeLayer.add.apply(this.activeLayer, arguments);
};

gl5.remove = function () {
    this.activeLayer.remove.apply(this.activeLayer, arguments);
};

gl5.createAnimation = function () {
    var params = Array.prototype.slice(arguments, 0);
    var entity = new AnimatedEntity();
    AnimatedEntity.apply(entity, arguments);
    this.add(entity);
    return entity;
};

gl5.createImage = function () {
    var params = Array.prototype.slice(arguments, 0);
    var entity = new ImageEntity();
    ImageEntity.apply(entity, arguments);
    this.add(entity);
    return entity;
};

gl5.createText = function () {
    var params = Array.prototype.slice(arguments, 0);
    var entity = new TextEntity();
    TextEntity.apply(entity, arguments);
    this.add(entity);
    return entity;
};

gl5.tagged = function (tag) {
    return this.activeLayer.tagged.apply(this.activeLayer, arguments);
};

gl5.forEach = function (/*tags, callback*/) {
    var args = Array.prototype.slice.call(arguments, 0),
        tags = args.slice(0, -1),
        callback = args.slice(-1)[0];

    if (tags.length === 1) {
        if (tags[0].length === 0) {
            return;
        } else if (tags[0].length !== undefined) {
            tags = tags[0];
        }
    }

    function cartesianProduct(tags, parameters) {
        if (tags.length == 0) {
            callback.apply(callback, parameters);
            return;
        }
        
        var firstList = null,
            rest = tags.slice(1),
            nPrevious = parameters.length;

        if (tags[0] === undefined) {
            firstList = MATCH_1;
        } else if (typeof tags[0] === 'string') {
            firstList = gl5.tagged(tags[0]); 
        } else if (tags[0].id !== undefined) {
            firstList = [tags[0]];
        } else {
            firstList = tags[0];
        }

        if (firstList.length === 0) {
            return;
        }

        parameters.push(null);
        for (var i in firstList) {
            parameters[nPrevious] = firstList[i];
            cartesianProduct(rest, parameters);
        }
    }

    cartesianProduct(tags, []);
};

gl5.filter = function (/*tags, filter*/) {
    var args = Array.prototype.slice.call(arguments, 0),
        filter = args[args.length - 1],
        rest = args.slice(0, -1),
        matches = [];

    rest.push(function () {
        var args = Array.prototype.slice.call(arguments, 0);
        if (filter.apply(gl5, args)) {
            matches.push(args);
        }
    });

    gl5.forEach.apply(gl5, rest);
    return matches;
}

gl5.render = function () {
    if (this.MOTION_BLUR_STRENGTH === 0) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
        this.context.save();
        this.context.globalAlpha = 1 - this.MOTION_BLUR_STRENGTH;
        this.context.globalCompositeOperation = 'destination-out';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.restore();
    }

    for (var i in this.layers) {
        var layer = this.layers[i];
        for (var i in layer.entities) {
            this.context.save();
            layer.entities[i].render(this.context);
            this.context.restore();
        }
    }
};

gl5.step = function () {
    var oldActiveLayer = this.activeLayer;

    for (var i in this.layers) {
        var layer = this.layers[i];
        if (layer.paused) {
            continue;
        }

        gl5.activeLayer = layer;

        for (var i in layer.entities) {
            layer.entities[i].step();
        }

        for (var i in layer.behaviors) {
            layer.behaviors[i]();
            if (gl5.activeLayer !== layer) {
                // Someone is messing with layers inside behaviors.
                // Throw the towel, discard the frame and let the programmer
                // choose what will be the next active layer.
                return;
            }
        }
    }

    for (var i = this.futureFunctions.length - 1; i >= 0; i--) {
        var time = this.futureFunctions[i][0],
            func = this.futureFunctions[i][1],
            layer = this.futureFunctions[i][2];

        if (time <= this.seconds) {
            this.activeLayer = layer;
            this.futureFunctions.splice(i, 1);
            func();
        }
    }

    this.activeLayer = oldActiveLayer;
};

gl5.processKeyEvent = function (event, value) {
    var keycode = event.which,
        hasCtrl = event.ctrlKey,
        isKnownSpecial = keycode in this.NAME_BY_KEYCODE,
        isAlpha = keycode >= 48 && keycode <= 90;

    this.pressedKeys[keycode] = value;
    if (isKnownSpecial) {
        this.pressedKeys[this.NAME_BY_KEYCODE[keycode]] = value;
    }
    if (isAlpha) {
        this.pressedKeys[String.fromCharCode(keycode).toUpperCase()] = value;
        this.pressedKeys[String.fromCharCode(keycode).toLowerCase()] = value;
    }

    if (!hasCtrl && (isKnownSpecial || isAlpha)) {
        event.preventDefault();
    }
};

window.addEventListener('mousemove', function (event) {
    var canvasBounds = gl5.canvas.getBoundingClientRect();
    var mouseX = event.clientX - canvasBounds.left,
        mouseY = event.clientY - canvasBounds.top;

    gl5.mouse.inertia.x = mouseX - gl5.mouse.pos.x;
    gl5.mouse.inertia.y = mouseY - gl5.mouse.pos.y;

    gl5.mouse.pos.x = mouseX;
    gl5.mouse.pos.y = mouseY;
}, false);

window.addEventListener('mousedown', function (event) {
    gl5.mouse.isDown = true;
}, false);

window.addEventListener('mouseup', function (event) {
    gl5.mouse.isDown = false;
}, false);

window.addEventListener('keydown', function (event) {
    gl5.processKeyEvent(event, true);
}, false);

window.addEventListener('keyup', function (event) {
    gl5.processKeyEvent(event, false);
}, false);


function Layer() {
    this.entities = {};
    this.behaviors = [];
    this.tags = {};
    this.paused = false;
    this.behaviorCount = 0;
}

Layer.prototype.tagged = function(tag) {
    if (this.tags[tag] === undefined) {
        this.tags[tag] = {};
    }
    return this.tags[tag];
}

Layer.prototype.register = function (/*tag1, tag2, tag3, func*/) {
    var args = Array.prototype.slice.call(arguments, 0),
        func = args.slice(-1)[0],
        tags = args.slice(0, -1);

    var id = ++this.behaviorCount;

    var behavior = function () {
        gl5.forEach.apply(gl5.forEach, args);
    }

    behavior.id = id;
    this.behaviors[behavior.id] = behavior;
    behavior.layer = this;
    return behavior;
};

Layer.prototype.unregister = function (behavior) {
    delete this.behaviors[behavior.id];
    delete behavior.id;
    delete behavior.layer;
};

Layer.prototype.add = function (entity) {
    if (entity.layer) {
        entity.layer.remove(entity);
    }
    entity.layer = this;
    this.entities[entity.id] = entity;
};

Layer.prototype.remove = function (entity) {
    delete this.entities[entity.id];
};

function Entity(draw, tags, pos, size, inertia, friction) {
    Entity.count = (Entity.count || 0) + 1;

    this.draw = draw;

    this.id = Entity.count;
    this.pos = fillDefault(pos, {x: gl5.canvas.width / 2,
                                 y: gl5.canvas.height / 2,
                                 angle: 0});
    this.size = fillDefault(size, {x: 0, y: 0});
    this.inertia = fillDefault(inertia, {x: 0, y: 0, angle: 0});
    this.friction = fillDefault(friction, {x: 0.8, y: 0.8, angle: 0.8});

    this.alpha = 1.0;
    this.effects = {};
    this.tags = {};


    if (tags === undefined) {
        tags = [];
    } else if (typeof tags === 'string') {
        tags = [tags];
    }

    for (var i in tags) {
        this.tag(tags[i]);
    }
}

Entity.prototype.destroy = function () {
    this.layer.remove(this);
    for (var tag in this.tags) {
        this.untag(tag);
    }
};

Entity.prototype.render = function (context) {
    context.translate(this.pos.x, this.pos.y);

    if (gl5.debug) {
        // Print all tags on top right corner of entity, one below
        // the other.
        context.fillText('Layer ' + gl5.layers.indexOf(this.layer),
                         this.size.x / 2, -this.size.y / 2);
        var i = 1;
        for (var tag in this.tags) {
            var x = this.size.x / 2,
                y = -this.size.y / 2 + i++ * 16;

            context.fillText(tag, x, y);
        }
        context.strokeRect(-this.size.x / 2, -this.size.y / 2,
                           this.size.x, this.size.y);
    }

    context.rotate(-this.pos.angle);
    if (this.alpha !== undefined) {
        context.globalAlpha = this.alpha;
    }

    for (var effectName in this.effects) {
        this.effects[effectName](context);
    }

    this.draw(context);
};

Entity.prototype.hitTest = function (other) {
    return !(this.pos.x - this.size.x / 2 > other.pos.x + other.size.x / 2 ||
             this.pos.x + this.size.x / 2 < other.pos.x - other.size.x / 2 ||
             this.pos.y - this.size.y / 2 > other.pos.y + other.size.y / 2 ||
             this.pos.y + this.size.y / 2 < other.pos.y - other.size.y / 2);
};

Entity.prototype.move = function (speed) {
    this.pos.x += speed.x || 0;
    this.pos.y += speed.y || 0;
    this.pos.angle += speed.angle || 0;
    /*
    while (this.pos.angle < 0) {
        this.pos.angle += Math.PI * 2;
    }*/
    while (this.pos.angle > Math.PI * 2) {
        this.pos.angle -= Math.PI * 2;
    }
};

Entity.prototype.push = function (acceleration) {
    this.inertia.x += acceleration.x || 0;
    this.inertia.y += acceleration.y || 0;
    this.inertia.angle += acceleration.angle || 0;
};

Entity.prototype.pushForward = function (force) {
    this.inertia.x += force * Math.cos(this.pos.angle);
    this.inertia.y -= force * Math.sin(this.pos.angle);
};

Entity.prototype.tag = function (tag) {
    this.tags[tag] = tag;
    gl5.tagged(tag)[this.id] = this;
};

Entity.prototype.untag = function (tag) {
    delete this.tags[tag];
    delete gl5.tagged(tag)[this.id];
};

Entity.prototype.step = function () {
    this.move(this.inertia);
    this.inertia.x *= (1 - this.friction.x);
    this.inertia.y *= (1 - this.friction.y);
    this.inertia.angle *= (1 - this.friction.angle);
    this.alpha = Math.min(Math.max(this.alpha, 0.0), 1.0);

    for (var effectName in this.effects) {
        delete this.effects[effectName];
    }
};

Entity.prototype.angleTo = function (otherEntity) {
    var difX = otherEntity.pos.x - this.pos.x,
        difY = otherEntity.pos.y - this.pos.y;
    return Math.atan2(-difY, difX);
};

Entity.prototype.distanceTo = function (otherEntity) {
    var difX = this.pos.x - otherEntity.pos.x,
        difY = this.pos.y - otherEntity.pos.y;
    return Math.sqrt(difX * difX + difY * difY);
};


function TextEntity(value/*, rest of Entity params*/) {
    Entity.apply(this, Array.prototype.slice.call(arguments, 0));
    this.inertia.value = this.inertia.value || 0;
    this.friction.value = this.inertia.value || 0;

    this.value = value;
    this.color = '';
    this.font ='';
    this.alignment = 'center';
    this.prefix = '';
    this.suffix = '';
    this.minDigits = 0;
    this.minValue = Number.NEGATIVE_INFINITY;
    this.maxValue = Number.POSITIVE_INFINITY;
    this.decimalPoints = 0;

    function pad(value, length) {
        value = value + '';
        if (value.length >= length) {
            return value;
        }
        return new Array(length - value.length + 1).join('0') + value;
    }

    this.draw = function (context) {
        context.shadowColor = '#666';
        context.shadowOffsetX = 1;
        context.shadowOffsetY = 1;
        context.shadowBlur = 3;

        var strValue;
        if (typeof this.value === 'number') {
            strValue = this.value.toFixed(this.decimalPoints);
        } else {
            strValue = this.value;
        }
        var paddedValue = pad(strValue, this.minDigits),
            text = this.prefix + paddedValue + this.suffix;

        context.fillStyle = this.color || context.fillStyle;
        context.font = this.font || context.font;
        context.textAlign = this.alignment || context.textAlign;

        var measure = context.measureText(text);
        this.size.x = measure.width;
        this.size.y = +this.font.slice(0, this.font.indexOf(' ') - 2);
        context.fillText(text, 0, this.size.y / 2);
    }
}

TextEntity.prototype = Object.create(Entity.prototype);
TextEntity.prototype.constructor = TextEntity;

TextEntity.prototype.move = function (speed) {
    if (speed.value) {
        this.value += speed.value;
    }
    Entity.prototype.move.call(this, speed);
}

TextEntity.prototype.push = function (acceleration) {
    if (acceleration.value) {
        this.inertia.value += acceleration.value;
    }
    Entity.prototype.push.call(this, acceleration);
}

TextEntity.prototype.step = function () {
    Entity.prototype.step.call(this);
    if (!isNaN(this.value)) {
        this.value += this.inertia.value;
        this.value = Math.min(Math.max(this.value, this.minValue), this.maxValue);
        this.inertia.value *= (1 - this.friction.value);
    }
}

function ImageEntity(imageSource/*, rest of Entity params*/) {
    Entity.apply(this, Array.prototype.slice.call(arguments, 0));
    if (!imageSource) {
        return;
    }

    var self = this;
    this.image = gl5.loadImage(imageSource, function (image) {
        if (self.size.x === 0 && self.size.y === 0) {
            self.size = {x: image.width, y: image.height};
        }
    });
    this.draw = function (context) {
        if (this.image.width !== 0) {
            context.drawImage(this.image, -this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);
        }
    }
}

ImageEntity.prototype = Object.create(Entity.prototype);
ImageEntity.prototype.constructor = ImageEntity;

ImageEntity.cache = {};



function AnimatedEntity(frameSources/*, other Entity params*/) {
    Entity.apply(this, Array.prototype.slice.call(arguments, 0));
    if (frameSources === undefined) {
        return;
    }
    this.frames = [];
    this.frame = 0;
    for (var i in frameSources) {
        this.frames[i] = gl5.loadImage(frameSources[i]);
    }

    this.draw = function (context) {
        var n = this.frames.length;
        while (this.frame >= n) {
            this.frame -= n;
        }
        while (this.frame < 0) {
            this.frame += n;
        }

        var frameImage = this.frames[this.frame];
        if (frameImage.width === 0) {
            return;
        }
    
        context.drawImage(frameImage, -this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);
    }
}

AnimatedEntity.prototype = Object.create(ImageEntity.prototype);
AnimatedEntity.prototype.constructor = AnimatedEntity;

AnimatedEntity.cache = {};


function rand(minValues, maxValues) {
    var obj = {};

    for (var property in minValues) {
        var min = minValues[property] || 0,
            max = maxValues[property] || 0;

        if (max === undefined) {
            obj[property] = min;
            continue;
        }

        obj[property] = Math.random() * (max - min) + min;
    }

    return obj;
}

function randCircle(center, radius) {
    var angle = Math.random() * Math.PI * 2;
    return  {x: center.x + Math.cos(angle) * radius,
             y: center.y + Math.sin(angle) * radius};
}

// Takes an object and fills empty values with defaults.
function fillDefault(original, def) {
    original = original || {};
    var obj = {};

    for (var property in def) {
        var cur = original[property];
        obj[property] = cur !== undefined ? cur : def[property];
    }

    return obj;
}
gl5.layer(new Layer());

gl5.mouse = new Entity(null);
gl5.mouse.isDown = false;
gl5.screen = new Entity(null, [],
                        {x: canvas.width / 2, y: canvas.height / 2},
                        {x: canvas.width, y: canvas.height});

for (var name in gl5.KEYCODE_BY_NAME) {
    gl5.NAME_BY_KEYCODE[gl5.KEYCODE_BY_NAME[name]] = name;
}

gl5.context.textAlign = 'right'
gl5.context.fillStyle = 'green';
gl5.context.font = 'bold 16px Verdana';

(function () {

    function run() {
        window.requestAnimationFrame(run);
        if (gl5.paused) {
            return;
        }

        var currentLoop = new Date;
        var timeDif = currentLoop - gl5.lastLoop;
        gl5.lastLoop = currentLoop;
        gl5.frameTime += (timeDif - gl5.frameTime) / gl5.FRAME_TIME_FILTER;
        gl5.fps = (1000 / gl5.frameTime).toFixed(1);

        gl5.seconds += timeDif / 1000;

        gl5.step();
        gl5.render();

        if (gl5.debug) {
            gl5.context.fillText(gl5.fps + ' fps', gl5.canvas.width, 20);
        }
    }
    run();
}());
