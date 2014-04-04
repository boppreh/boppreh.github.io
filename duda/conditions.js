function mouseOver(objectTag) {
    return hit(objectTag, gl5.mouse);
}

function mouseDown(objectTag) {
    if (objectTag === undefined) {
        return gl5.mouse.isDown;
    }

    if (!gl5.mouse.isDown) {
        return [];
    }

    return mouseOver(objectTag);
}

var click = (function () {
    var clicked = false;

    window.addEventListener('mousedown', function () {
        clicked = true;
    })

    return function (target) {
        if (!clicked) {
            return [];
        }

        return mouseOver(target);
    };
}());

function hit(objectTag, targetTag) {
    return gl5.filter(objectTag, targetTag, function (object, target) {
        return object.hitTest(target);
    });
}

function circleHit(objectTag, targetTag) {
    return gl5.filter(objectTag, targetTag, function (object, target) {
        var difX = target.pos.x - object.pos.x,
            difY = target.pos.y - object.pos.y,
            distance = Math.sqrt(difX * difX + difY * difY),
            radiusA = (object.size.x + object.size.y) / 4,
            radiusB = (target.size.x + target.size.y) / 4;

        return distance <= radiusA + radiusB;
    });
}

function distance(objectTag, targetTag, maxDistance) {
    return gl5.filter(objectTag, targetTag, function (object, target) {
        var difX = target.pos.x - object.pos.x,
            difY = target.pos.y - object.pos.y,
            distance = Math.sqrt(difX * difX + difY * difY),
            radiusA = (object.size.x + object.size.y) / 4,
            radiusB = (target.size.x + target.size.y) / 4;

        return distance > maxDistance;
    });
}

function exists(tag) {
    for (var i in gl5.tagged(tag)) {
        return [[]];
    }
    return [];
}
