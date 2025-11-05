import { Boot } from './scenes/Boot.js';
import { Game } from './scenes/Game.js';
import { GameOver } from './scenes/GameOver.js';
import { Preloader } from './scenes/Preloader.js';
import { FirebasePlugin } from './plugins/FirebasePlugin.js';

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    physics: {
        default: 'arcade'
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    plugins: {
        global: [
            {
                key: 'FirebasePlugin',
                plugin: FirebasePlugin,
                start: true
            }
        ]
    },
    scene: [
        Boot,
        Preloader,
        Game,
        GameOver
    ]
};

const game = new Phaser.Game(config);

// Initialize Firebase when game is created
game.events.on('ready', () => {
    const firebasePlugin = game.plugins.get('FirebasePlugin');
    firebasePlugin.initializeFirebase().then(success => {
        if (success) {
            console.log('Firebase ready for game integration');
        }
    });
});