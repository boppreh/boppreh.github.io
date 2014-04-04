function move(objectTag, speed) {
    gl5.forEach(objectTag, function (object) {
        object.move(speed);
    })
}

function moveTo(sourceTag, targetTag) {
    gl5.forEach(sourceTag, targetTag, function (source, target) {
        source.pos.x = target.pos.x;
        source.pos.y = target.pos.y;
    });
}

function push(target, acceleration) {
    gl5.forEach(target, function (object) {
        object.push(acceleration);
    });
}

function pushAngle(target, angle, force) {
    gl5.forEach(target, function (object) {
        object.push({x: Math.cos(angle) * force, y: Math.sin(angle) * force});
    });
}

function follow(objTag, targetTag, force, maxTolerableDistance, turningSpeed) {
    force = force !== undefined ? force : 5;
    turningSpeed = turningSpeed !== undefined ? turningSpeed : Math.PI;
    maxTolerableDistance = maxTolerableDistance !== undefined ? maxTolerableDistance : 10;

    gl5.forEach(objTag, targetTag, function (object, target) {
        var distance = object.distanceTo(target);
            angle = object.angleTo(target),
            totalAngularDifference = angle - object.pos.angle;

        if (totalAngularDifference > Math.PI) {
            totalAngularDifference -= Math.PI * 2;
        } else if (totalAngularDifference < -Math.PI) {
            totalAngularDifference += Math.PI * 2;
        }

        if (Math.abs(totalAngularDifference) <= turningSpeed) {
            object.pos.angle = angle;
        } else if (totalAngularDifference > 0) {
            object.pos.angle += turningSpeed;
        } else {
            object.pos.angle -= turningSpeed;
        }        

        if ((force > 0 && distance <= maxTolerableDistance) ||
            (force < 0 && distance >= maxTolerableDistance)) {
            return;
        }

        object.pushForward(force);        
    });
}

function attract(objectTag, targetTag, constantForce, elasticForce) {
    constantForce = constantForce === undefined ? 5 : constantForce;
    elasticForce = elasticForce === undefined ? 0 : elasticForce;

    gl5.forEach(objectTag, targetTag, function (object, target) { 
        var difX = target.pos.x - object.pos.x,
            difY = target.pos.y - object.pos.y,
            angle = Math.atan2(difY, difX),
            distance = Math.max(Math.sqrt(difX * difX + difY * difY), 1),
            f = constantForce + 1 / distance * elasticForce;

        object.push({x: Math.cos(angle) * f, y: Math.sin(angle) * f});
    });
}

function create(img, tags, pos, inertia, friction) {
    gl5.forEach(function () {
        var tagsCopy = tags.slice();
        gl4.createImage(img, tagsCopy, pos, inertia, friction);
    });
}

function wrap(target, start, end) {
    if (end === undefined && start !== undefined) {
        end = start;
        start = undefined;
    }

    start = start || {x: 0, y: 0};
    end = end || {x: canvas.width, y: canvas.height};
    var size = {x: end.x - start.x, y: end.y - start.y};

    gl5.forEach(target, function (object) {
        var pos = object.pos;

        if (pos.x < start.x) {
            pos.x += size.x;
        } else if (pos.x > end.x) {
            pos.x -= size.x;
        }

        if (pos.y < start.y) {
            pos.y += size.y;
        } else if (pos.y > end.y) {
            pos.y -= size.y;
        }
    });
}

function reflect(target, start, end) {
    if (end === undefined && start !== undefined) {
        end = start;
        start = undefined;
    }

    start = start || {x: 0, y: 0};
    end = end || {x: canvas.width, y: canvas.height};

    gl5.forEach(target, function (object) {
        var pos = object.pos;
        var inertia = object.inertia;

        for (var property in start) {
            if (pos[property] < start[property]) {
                inertia[property] = Math.abs(inertia[property]);
            } else if (pos[property] > end[property]) {
                inertia[property] = -Math.abs(inertia[property]);
            }
        }
    });
}

function limit(target, start, end) {
    if (end === undefined && start !== undefined) {
        end = start;
        start = undefined;
    }

    start = start || {x: 0, y: 0};
    end = end || {x: canvas.width, y: canvas.height};

    gl5.forEach(target, function (object) {
        var pos = object.pos;

        for (var property in start) {
            if (pos[property] < start[property]) {
                pos[property] = start[property];
            } else if (pos[property] > end[property]) {
                pos[property] = end[property];
            }
        }
    });
}

function shoot(origin, imgSource, tags, force, friction) {
    force = force === undefined ? 10 : force;
    friction = fillDefault(friction, {x: 0.01, y: 0.01});
    gl5.forEach(origin, function (obj) {
        var angle = obj.pos.angle,
            distance = obj.size.x / 2,
            cos = Math.cos(angle),
            sin = -Math.sin(angle),
            pos = {x: obj.pos.x + cos * distance,
                   y: obj.pos.y + sin * distance,
                   angle: angle},
            inertia = {x: cos * force,
                       y: sin * force};

        gl4.createImage(imgSource, tags, pos, {}, inertia, friction);
    });
}

function slowDown(tag, slowness) {
    slowness = fillDefault(slowness, {x: 0.5, y: 0.5, angle: 0.5});
    gl5.forEach(tag, function (object) {
        object.inertia.x *= 1 - slowness.x;
        object.inertia.y *= 1 - slowness.y;
        object.inertia.angle *= 1 - slowness.angle;
    });
}

function swapTags(firstTag, secondTag) {
    gl5.forEach(function () {
        gl4.forEach(firstTag, function (object) {
            object.untag(firstTag); 
            object.tag('temporary swap tag'); 
        });
        gl4.forEach(secondTag, function (object) {
            object.untag(secondTag); 
            object.tag(firstTag); 
        });
        gl4.forEach('temporary swap tag', function (object) {
            object.tag(secondTag); 
            object.untag('temporary swap tag'); 
        });
    });
}

function tag(targets, tag) {
    gl5.forEach(targets, function (target) {
        target.tag(tag);
    });
}

function untag(targets, tag) {
    gl5.forEach(targets, function (target) {
        target.untag(tag);
    });
}

function sound(src) {
    gl5.forEach(function () {
        new Audio(src).play();
    });
}

function destroy(tag) {
    gl5.forEach(tag, function (object) {
        object.destroy();
    });
}

function fadeOut(tag, speed) {
    speed = speed === undefined ? 0.05 : speed;

    gl5.forEach(tag, function (object) {
        object.alpha -= speed;
        if (object.alpha <= 0) {
            object.destroy();
        }
    });
}

function fadeIn(tag, speed) {
    speed = speed === undefined ? 0.05 : speed;

    gl5.forEach(tag, function (object) {
        object.alpha += speed;
    });
}

function expand(tag, speed) {
    if (speed === undefined) {
        speed = {x: 0.01, y: 0.01};
    } else if (typeof speed === 'number') {
        speed = {x: speed, y: speed};
    }

    gl5.forEach(tag, function (object) {
        object.size.x *= 1 + speed.x;
        object.size.y *= 1 + speed.y;
    });
}

function glow(object, color, size) {
    size = size === undefined ? 8 : size;
    color = color === undefined ? 'white' : color;
    function effect(context) {
        context.shadowColor = color;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = size;
    }
    gl5.forEach(object, function (object) {
        object.effects['shadow'] = effect;
    });
}

function shadow(object, offset, blur, color) {
    color = color === undefined ? 'black' : color;
    blur = blur === undefined ? 3 : blur;
    offset = fillDefault(offset, {x: 2, y: 2});

    function effect(context) {
        context.shadowColor = color;
        context.shadowOffsetX = offset.x;
        context.shadowOffsetY = offset.y;
        context.shadowBlur = blur;
    }

    gl5.forEach(object, function (object) {
        object.effects['shadow'] = effect;
    });
}

function alpha(object, amount) {
    amount = amount === undefined ? 0.5 : amount;

    gl5.forEach(object, function (object) {
        object.alpha = amount;
    });
}

function keyboardControl(objectTag, controls, force, frictionAmount) {
    controls = controls || ['up', 'down', 'left', 'right'];
    force = force === undefined ? 1 : force;
    gl5.forEach(objectTag, function (object) {
        if (frictionAmount !== undefined) {
            object.friction.x = frictionAmount;
            object.friction.y = frictionAmount;
        }

        if (gl4.pressedKeys[controls[0]]) {
            object.push({y: -force});
        }
        if (gl4.pressedKeys[controls[1]]) {
            object.push({y: force});
        }
        if (gl4.pressedKeys[controls[2]]) {
            object.push({x: -force});
        }
        if (gl4.pressedKeys[controls[3]]) {
            object.push({x: force});
        }
    });

}

function play(objectTag, speed) {
    gl5.forEach(objectTag, function (object) {
        object.frame += speed;
    });
}
