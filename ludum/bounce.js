var playerPng = 'http://raw.github.com/boppreh/ludum_dare28/master/player.png',
    ballPng = 'http://raw.github.com/boppreh/ludum_dare28/master/ball.png',
    targetPng = 'http://raw.github.com/boppreh/ludum_dare28/master/target.png',
    enemyPng = 'http://raw.github.com/boppreh/ludum_dare28/master/enemy.png',
    explosionPng = 'http://raw.github.com/boppreh/ludum_dare28/master/explosion.png';

function makeCursor() {
    player = gl4.createImage(playerPng, 'player'); 
    moveTo('player', gl4.mouse);
    shadow('idle attractor', 8, 8, 2);
    glow('attractor', '#66F', 20);
    push('idle attractor', {angle: 0.01});
    push('attractor', {angle: -0.1});
    on(or(mouseDown(), keyDown('space')),
       [tag('player', 'attractor'), untag('player', 'idle attractor')],
       [tag('player', 'idle attractor'), untag('player', 'attractor')]);
}

function Mission(props) {
    var self = this;
    props = fillDefault(props, {attackFrequency: 3,
                                nLives: 1000,
                                //regeneration: 1,
                                goal: function () { return false; },
                                onSuccess: function () {},
                                onFailure: function () {},
                                damagePerHit: 1,
                                onDamage: function () {
                                    if (self.lives === undefined) { return; }
                                    self.lives.push({value: -self.damagePerHit});
                                },
                                pointsPerKill: 10,
                                onKill: function () {
                                    if (self.points === undefined) { return; }
                                    self.points.value += self.pointsPerKill;
                                }
                               });

    for (var property in props) {
        this[property] = props[property];
    }
}

Mission.prototype.mainMechanics = function () {
    var self = this;
    var ball = gl4.createImage(ballPng, 'ball', {}, {}, {},
                               {x: 0.01, y: 0.01, angle: 0}); 
    glow('ball', '#66F', 20);
    reflect('ball');

    var target = gl4.createImage(targetPng, 'target'); 

    on(pulse(this.attackFrequency),
       create(enemyPng, 'enemy', randCircle(gl4.screen.pos, 400)));
    follow('enemy', 'target', 2);
    on(circleHit('enemy', 'target'),
       [destroy(), function () { self.onDamage(self); } ]);
    on(circleHit('ball', 'enemy'),
       [destroy(MATCH_2), attract(MATCH_1, MATCH_2, -5), this.onKill,
        function () {
            gl4.createImage(explosionPng, 'explosion', MATCH_2[0].pos);
        }]);
    expand('explosion', 0.05);
    fadeOut('explosion', 0.1);

    gl4.register('enemy', function(enemy) {
        enemy.pos.angle = Math.atan2(-enemy.inertia.y, enemy.inertia.x);
    });
};

Mission.prototype.start = function () {
    var self = this;
    gl4.unlayerAll();

    var gameLayer = gl4.layer();

    makeCursor();

    var uiLayer = gl4.layer();
    this.time = gl4.createText(0, 'text', {x: gl4.canvas.width - 50, y: 60});
    this.time.font = '72px Impact';
    this.time.color = '#66F';
    this.time.alignment = 'right';
    gl4.register(function () {
        if (self.targetTime) {
            self.time.value = self.targetTime - (gl4.seconds - self.startTime);
        } else {
            self.time.value = gl4.seconds - self.startTime;
        }
    });

    this.lives = gl4.createText(this.nLives, 'text', {x: 50, y: 60});
    this.lives.friction.value = 0.1;
    this.lives.font = '72px Impact';
    this.lives.color = 'red';
    this.lives.alignment = 'left';
    this.lives.minValue = 0;
    this.lives.maxValue = this.nLives;

    this.points = gl4.createText(0, 'text', {x: 50, y: 60 + 72});
    this.points.font = this.lives.font;
    this.points.color = 'green';
    this.points.alignment = 'left';
    this.points.minDigits = 5;

    shadow('text');
    gl4.layer(gameLayer);

    attract('ball', 'attractor', 2, 20);
    this.mainMechanics();

    on(function () { return self.goal(self) ? [[]] : []; },
       this.onSuccess);
    on(this.lives.at(0),
       this.onFailure);

    uiLayer.paused = true;
    gameLayer.paused = true;
    var instructionLayer = gl4.layer();
    makeCursor();
    var instructionText = gl4.createText('Click to start', 'text', {y: 500});
    shadow('text');
    instructionText.font = '48px Impact';
    instructionText.color = 'green';
    on(mouseDown(),
       function () {
           self.startTime = gl4.seconds;
           gameLayer.paused = false;
           uiLayer.paused = false;
           gl4.unlayer();
       });
};

function splashText(text, interval, fadeOutTime, onFinished) {
    gl4.layer();
    shadow('tutorial text');
    var lines = text.split('\n'),
        n = lines.length,
        spacing = gl4.canvas.height * 0.8 / n,
        top = gl4.canvas.height * 0.2;

    fadeIn('appearing text');
    fadeOut('disappearing text');
    lines.forEach(function (line) {
        if (!line) {
            return;
        }

        var i = lines.indexOf(line);
        var y = n === 1 ? gl4.canvas.height / 2 : top + i * spacing,
            text = gl4.createText(line, [], {y: y});
        text.color = 'red';
        text.font = '48px Impact';
        text.alpha = 0.0;

        gl4.schedule(i * interval, tag(text, 'appearing text'));
        gl4.schedule(i * interval + fadeOutTime, function () {
            text.untag('appearing text');
            text.tag('disappearing text');
        });
    });

    gl4.schedule(interval * n + fadeOutTime, function () {
        gl4.unlayer();
        onFinished && onFinished();
    });
}

function survive(time) {
    var survived = false;
    return function (mission) {
        mission.targetTime = time;
        return gl4.seconds - mission.startTime > time;
    }
}

//gl4.debug = true;
var currentLevel = 0,
    levels = [

    {attackFrequency: 0.0, nLives: 1000, goal: survive(20), fadeOutTime: 3.0,
     instructions: 'We made the perfect weapon\n\n(Click and hold, play around a bit)'},

    {attackFrequency: 0.3, nLives: 1000, goal: survive(30), fadeOutTime: 4.0,
     instructions: 'Nobody thought we needed more\nDefending was easy'},

    {attackFrequency: 2.0, nLives: 1000, goal: survive(30), fadeOutTime: 7.0,
     instructions: 'Until they came from all sides.'},

    {attackFrequency: 4.0, nLives: 1000, damagePerHit: 0.5, goal: survive(30), fadeOutTime: 5.0,
     instructions: 'The problem with having\nOne perfect weapon\nIs that you\nOnly get one'},

    {attackFrequency: 10, nLives: 1000, damagePerHit: 0.1, goal: survive(60), fadeOutTime: 2.0,
     instructions: 'DEFEND\nTHE\nBASE\nFOR THE LAST 60 seconds'}
];

function startLevel() {
    gl4.unlayerAll();

    if (currentLevel >= levels.length) {
        currentLevel = 0;
        splashText('CONGRATULATIONS!\nYOU SAVED LIKE\nEVERYTHING!', 1.5, 1.0, makeStartScreen);
        return;
    }
    var level = levels[currentLevel];
    level.onFailure = startLevel;
    level.onSuccess = function () {
        destroy('player')();
        gl4.layers[1].paused = true;
        gl4.layers[2].paused = true;
        gl4.layer();
        makeCursor();
        var instructionText = gl4.createText('Victory!', 'text', {y: 500});
        instructionText.font = '48px Impact';
        instructionText.color = 'green';
        shadow('text');
        gl4.schedule(3, function () {
            currentLevel++;
            gl4.unlayerAll();
            startLevel();
        });
    }

    var mission = new Mission(level)

    gl4.layer();
    makeCursor();
    splashText(level.instructions,
               0.8, (level.fadeOutTime || 1.0) + 0.1,
               function () { mission.start(); });
}

function makeStartScreen() {
    gl4.unlayerAll();
    var lowerLayer = gl4.activeLayer;

    var topLayer = gl4.layer();
    makeCursor();
    gl4.layer(lowerLayer);

    var demoLayer = gl4.layer();
    var demoMission = new Mission({attackFrequency: 0.5});
    demoMission.mainMechanics();
    attract('ball', 'enemy', 0.05);
    gl4.forEach('ball', function (ball) {
        ball.push({x: Math.random() * 2 - 1, y: -Math.random() * 2});
    });

    var startScreen = gl4.layer();
    var title = gl4.createText('Bounce', ['screen text'], {y: 200});
    title.font = '126px Impact';

    var btnStart = gl4.createText('New Game', ['screen text', 'button'], {y: 400});
    btnStart.font = '62px Impact';
    //btnStart.

    shadow('screen text');
    gl4.forEach('screen text', function (t) {
        t.friction = {x: 0.01, y: 0.01, angle: 0.01};
        t.push({x: Math.random() * 0.2 - 0.1,
                y: Math.random() * 0.2 - 0.1,
                angle: Math.random() * 0.002 - 0.001})
    });

    on(click(btnStart), startLevel);
}

makeStartScreen();
