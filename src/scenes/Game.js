export class Game extends Phaser.Scene {
    constructor() {
        super('Game');

        this.bricks;
        this.paddle;
        this.ball;
        this.ballTrail;
        this.brickEmitters;
        this.score = 0;
        this.bricksDestroyed = 0;
        this.level = 1;
        this.lives = 3;
        this.gameStarted = false;
    }

    create() {
        // Initialize Firebase plugin
        this.firebase = this.plugins.get('FirebasePlugin');
        
        // Log game start
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logGameStart();
        }

        //  Enable world bounds, but disable the floor
        this.physics.world.setBoundsCollision(true, true, true, false);

        // Create brick explosion particles for each color
        const colorConfig = {
            'blue1': 0x4444ff,
            'red1': 0xff4444,
            'green1': 0x44ff44,
            'yellow1': 0xffff44,
            'silver1': 0xcccccc,
            'purple1': 0xff44ff
        };

        this.brickEmitters = {};
        Object.entries(colorConfig).forEach(([color, tint]) => {
            this.brickEmitters[color] = this.add.particles(0, 0, 'assets', {
                frame: 'ball1',
                lifespan: 800,
                speed: { min: 150, max: 250 },
                scale: { start: 0.4, end: 0 },
                alpha: { start: 1, end: 0 },
                blendMode: 'ADD',
                gravityY: 300,
                tint,
                emitting: false
            });
        });

        //  Create the bricks in a 10x6 grid
        this.bricks = this.physics.add.staticGroup({
            key: 'assets',
            frame: ['blue1', 'red1', 'green1', 'yellow1', 'silver1', 'purple1'],
            frameQuantity: 10,
            gridAlign: { width: 10, height: 6, cellWidth: 64, cellHeight: 32, x: 192, y: 100 }
        });

        this.ball = this.physics.add.image(512, 600, 'assets', 'ball1')
        this.ball.setCollideWorldBounds(true)
        this.ball.setBounce(1);
        this.ball.setData('onPaddle', true);

        // Create particles for ball trail
        this.ballTrail = this.add.particles(0, 0, 'assets', {
            frame: 'ball1',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.3, end: 0 },
            speed: 20,
            lifespan: 1000,
            blendMode: 'ADD',
            follow: this.ball
        });

        this.paddle = this.physics.add.image(512, 700, 'assets', 'paddle1').setImmovable();

        //  Our colliders
        this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);
        this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);

        // Add UI elements
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#fff',
            fontFamily: 'Arial'
        });

        this.livesText = this.add.text(16, 50, 'Lives: 3', {
            fontSize: '24px',
            fill: '#fff',
            fontFamily: 'Arial'
        });

        this.levelText = this.add.text(16, 84, 'Level: 1', {
            fontSize: '24px',
            fill: '#fff',
            fontFamily: 'Arial'
        });

        // Add Firebase status text if available
        if (this.firebase && this.firebase.isInitialized) {
            this.firebaseStatus = this.add.text(16, 118, 'Firebase: Connected', {
                fontSize: '16px',
                fill: '#4CAF50',
                fontFamily: 'Arial'
            });

            // Add user status if authenticated
            if (this.firebase.isAuthenticated()) {
                this.userStatus = this.add.text(16, 142, `User: ${this.firebase.getCurrentUser().email}`, {
                    fontSize: '14px',
                    fill: '#FFD700',
                    fontFamily: 'Arial'
                });
            } else {
                this.userStatus = this.add.text(16, 142, 'User: Not signed in', {
                    fontSize: '14px',
                    fill: '#ff4444',
                    fontFamily: 'Arial'
                });
            }
        }

        //  Input events
        this.input.on('pointermove', (pointer) => {
            //  Keep the paddle within the game
            this.paddle.x = Phaser.Math.Clamp(pointer.x, 52, 972);

            if (this.ball.getData('onPaddle')) {
                this.ball.x = this.paddle.x;
            }
        }, this);

        this.input.on('pointerup', (pointer) => {
            if (this.ball.getData('onPaddle')) {
                this.ball.setVelocity(-75, -300);
                this.ball.setData('onPaddle', false);
                this.gameStarted = true;
                
                // Log first ball launch
                if (this.firebase && this.firebase.isInitialized) {
                    this.firebase.logEvent('ball_launched');
                }
            }
        });

        // Add keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();
        
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.ball.getData('onPaddle')) {
                this.ball.setVelocity(-75, -300);
                this.ball.setData('onPaddle', false);
                this.gameStarted = true;
                
                if (this.firebase && this.firebase.isInitialized) {
                    this.firebase.logEvent('ball_launched');
                }
            }
        });

        // Add restart key
        this.input.keyboard.on('keydown-R', () => {
            this.resetGame();
        });
    }

    hitBrick(ball, brick) {
        const brickColor = brick.frame.name;

        // Create explosion effect at brick position
        this.brickEmitters[brickColor].emitParticleAt(brick.x, brick.y, 12);
        this.brickEmitters[brickColor].setDepth(100);

        // Update score based on brick color
        let points = 100;
        if (brickColor === 'silver1') points = 200;
        if (brickColor === 'purple1') points = 300;
        
        this.updateScore(points);
        this.bricksDestroyed++;

        // Log brick destruction
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logEvent('brick_destroyed', {
                brick_color: brickColor,
                points: points,
                total_score: this.score
            });
        }

        this.tweenAlpha(brick, () => {
            brick.disableBody(true, true);
        });

        if (this.bricks.countActive() === 0) {
            this.levelComplete();
        }
    }

    updateScore(points) {
        this.score += points;
        this.scoreText.setText('Score: ' + this.score);
    }

    updateLives() {
        this.livesText.setText('Lives: ' + this.lives);
    }

    updateLevel() {
        this.levelText.setText('Level: ' + this.level);
    }

    resetBall() {
        this.ball.setVelocity(0);
        this.ball.setPosition(this.paddle.x, 600);
        this.ball.setData('onPaddle', true);
        
        this.lives--;
        this.updateLives();

        // Log life lost
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logEvent('life_lost', {
                remaining_lives: this.lives,
                current_score: this.score
            });
        }

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    resetLevel() {
        this.resetBall();

        this.bricks.children.each(brick => {
            brick.enableBody(false, 0, 0, true, true);
        });
    }

    levelComplete() {
        this.level++;
        this.updateLevel();

        // Log level completion
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logLevelComplete(this.level, this.score);
            
            // Save high score if user is authenticated
            if (this.firebase.isAuthenticated()) {
                this.firebase.saveHighScore(this.score, this.level);
                
                // Also save game data
                this.firebase.saveGameData({
                    score: this.score,
                    level: this.level,
                    lives: this.lives,
                    bricksDestroyed: this.bricksDestroyed,
                    lastLevelCompleted: this.level
                });
            }
        }

        // Show level complete message
        const levelCompleteText = this.add.text(512, 384, `Level ${this.level - 1} Complete!`, {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Flash effect
        this.tweens.add({
            targets: levelCompleteText,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                levelCompleteText.destroy();
                this.resetLevel();
            }
        });
    }

    gameOver() {
        // Log game over
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logGameOver(this.score, this.bricksDestroyed);
            
            // Save final high score
            if (this.firebase.isAuthenticated()) {
                this.firebase.saveHighScore(this.score, this.level);
                
                // Show high scores
                this.showHighScores();
            } else {
                this.scene.start('GameOver', { 
                    score: this.score,
                    level: this.level,
                    bricksDestroyed: this.bricksDestroyed
                });
            }
        } else {
            this.scene.start('GameOver', { 
                score: this.score,
                level: this.level,
                bricksDestroyed: this.bricksDestroyed
            });
        }
    }

    async showHighScores() {
        if (this.firebase && this.firebase.isInitialized) {
            const result = await this.firebase.getHighScores(5);
            
            if (result.success) {
                // Create high scores display
                const bg = this.add.rectangle(512, 384, 400, 300, 0x000000, 0.8);
                const title = this.add.text(512, 250, 'HIGH SCORES', {
                    fontFamily: 'Arial Black',
                    fontSize: 32,
                    color: '#ffffff'
                }).setOrigin(0.5);
                
                let y = 300;
                result.scores.forEach((score, index) => {
                    const rank = index + 1;
                    const text = this.add.text(512, y, `${rank}. ${score.userEmail}: ${score.score}`, {
                        fontFamily: 'Arial',
                        fontSize: 20,
                        color: '#ffffff'
                    }).setOrigin(0.5);
                    y += 30;
                });
                
                const continueText = this.add.text(512, 500, 'Click to continue', {
                    fontFamily: 'Arial',
                    fontSize: 18,
                    color: '#ffff00'
                }).setOrigin(0.5);
                
                // Wait for click to go to game over scene
                this.input.once('pointerdown', () => {
                    this.scene.start('GameOver', { 
                        score: this.score,
                        level: this.level,
                        bricksDestroyed: this.bricksDestroyed,
                        highScores: result.scores
                    });
                });
            } else {
                this.scene.start('GameOver', { 
                    score: this.score,
                    level: this.level,
                    bricksDestroyed: this.bricksDestroyed
                });
            }
        }
    }

    resetGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.bricksDestroyed = 0;
        this.gameStarted = false;
        
        this.updateScore(0);
        this.updateLives();
        this.updateLevel();
        
        this.resetLevel();
        
        // Log game reset
        if (this.firebase && this.firebase.isInitialized) {
            this.firebase.logEvent('game_reset');
        }
    }

    hitPaddle(ball, paddle) {
        let diff = 0;

        if (ball.x < paddle.x) {
            //  Ball is on the left-hand side of the paddle
            diff = paddle.x - ball.x;
            ball.setVelocityX(-10 * diff);
        }
        else if (ball.x > paddle.x) {
            //  Ball is on the right-hand side of the paddle
            diff = ball.x - paddle.x;
            ball.setVelocityX(10 * diff);
        }
        else {
            //  Ball is perfectly in the middle
            //  Add a little random X to stop it bouncing straight up!
            ball.setVelocityX(2 + Math.random() * 8);
        }
        
        // Log paddle hit
        if (this.firebase && this.firebase.isInitialized && this.gameStarted) {
            this.firebase.logEvent('paddle_hit', {
                paddle_x: paddle.x,
                ball_x: ball.x
            });
        }
    }

    tweenAlpha(target, callback) {
        this.tweens.add({
            targets: target,
            alpha: 0,
            duration: 150,
            ease: 'Sine.inOut',
            onComplete: callback
        });
    }

    update() {
        // Keyboard controls for paddle
        if (this.cursors.left.isDown) {
            this.paddle.x = Phaser.Math.Clamp(this.paddle.x - 10, 52, 972);
            if (this.ball.getData('onPaddle')) {
                this.ball.x = this.paddle.x;
            }
        }
        else if (this.cursors.right.isDown) {
            this.paddle.x = Phaser.Math.Clamp(this.paddle.x + 10, 52, 972);
            if (this.ball.getData('onPaddle')) {
                this.ball.x = this.paddle.x;
            }
        }

        if (this.ball.y > 768) {
            this.resetBall();
        }
    }
}