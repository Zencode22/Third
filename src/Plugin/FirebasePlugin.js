export class FirebasePlugin extends Phaser.Plugins.BasePlugin {
    constructor(pluginManager) {
        super(pluginManager, 'FirebasePlugin');
        
        // Your actual Firebase configuration
        this.config = {
            apiKey: "AIzaSyCuOoDQNhzvrG8hc-onqN5K-JfC33_xq-k",
            authDomain: "phaser-game-b7b84.firebaseapp.com",
            projectId: "phaser-game-b7b84",
            storageBucket: "phaser-game-b7b84.firebasestorage.app",
            messagingSenderId: "704696148283",
            appId: "1:704696148283:web:178806881ced30b62f971e"
        };
        
        this.firebase = null;
        this.auth = null;
        this.firestore = null;
        this.analytics = null;
        this.isInitialized = false;
        this.user = null;
    }

    init() {
        console.log('FirebasePlugin initialized');
    }

    async initializeFirebase() {
        try {
            // Dynamically import Firebase modules
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            const { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, orderBy, limit, getDocs, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
            const { getAnalytics, logEvent } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js');
            
            // Store the imported functions for later use
            this.firebase = { initializeApp };
            this.firestoreModule = { 
                getFirestore, collection, doc, setDoc, getDoc, addDoc, query, orderBy, limit, getDocs, serverTimestamp 
            };
            this.analyticsModule = { getAnalytics, logEvent };
            this.authModule = { getAuth };
            
            // Initialize Firebase
            const app = initializeApp(this.config);
            
            // Initialize services
            this.auth = getAuth(app);
            this.firestore = getFirestore(app);
            this.analytics = getAnalytics(app);
            
            this.isInitialized = true;
            console.log('Firebase initialized successfully with project:', this.config.projectId);
            
            // Set up auth state listener
            this.setupAuthListener();
            
            return true;
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            return false;
        }
    }

    setupAuthListener() {
        // Import auth state listener dynamically when needed
        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js').then(({ onAuthStateChanged }) => {
            onAuthStateChanged(this.auth, (user) => {
                this.user = user;
                if (user) {
                    console.log('User signed in:', user.email);
                    this.game.events.emit('userSignedIn', user);
                } else {
                    console.log('User signed out');
                    this.game.events.emit('userSignedOut');
                }
            });
        });
    }

    // Authentication methods
    async signIn(email, password) {
        if (!this.isInitialized) {
            await this.initializeFirebase();
        }
        
        try {
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signUp(email, password) {
        if (!this.isInitialized) {
            await this.initializeFirebase();
        }
        
        try {
            const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        if (!this.isInitialized) return { success: false, error: 'Firebase not initialized' };
        
        try {
            const { signOut } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            await signOut(this.auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Firestore methods for game data
    async saveGameData(data) {
        if (!this.isInitialized || !this.user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const userDocRef = doc(this.firestore, 'users', this.user.uid);
            await setDoc(userDocRef, {
                ...data,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async loadGameData() {
        if (!this.isInitialized || !this.user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const userDocRef = doc(this.firestore, 'users', this.user.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                return { success: true, data: docSnap.data() };
            } else {
                return { success: false, error: 'No data found' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // High scores functionality
    async saveHighScore(score, level = 1) {
        if (!this.isInitialized || !this.user) {
            return { success: false, error: 'Not authenticated' };
        }
        
        try {
            const highScoresRef = collection(this.firestore, 'highscores');
            await addDoc(highScoresRef, {
                userId: this.user.uid,
                userEmail: this.user.email,
                score: score,
                level: level,
                timestamp: serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getHighScores(limit = 10) {
        if (!this.isInitialized) {
            return { success: false, error: 'Firebase not initialized' };
        }
        
        try {
            const highScoresRef = collection(this.firestore, 'highscores');
            const q = query(
                highScoresRef,
                orderBy('score', 'desc'),
                limit(limit)
            );
            
            const querySnapshot = await getDocs(q);
            const scores = [];
            
            querySnapshot.forEach((doc) => {
                scores.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, scores };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Analytics
    logEvent(eventName, parameters = {}) {
        if (!this.isInitialized) return;
        
        try {
            this.analyticsModule.logEvent(this.analytics, eventName, parameters);
        } catch (error) {
            console.error('Error logging analytics event:', error);
        }
    }

    // Game-specific events
    logGameStart() {
        this.logEvent('game_start');
    }

    logLevelComplete(level, score) {
        this.logEvent('level_complete', { level, score });
    }

    logGameOver(finalScore, bricksDestroyed) {
        this.logEvent('game_over', { final_score: finalScore, bricks_destroyed: bricksDestroyed });
    }

    // Utility methods
    getCurrentUser() {
        return this.user;
    }

    isAuthenticated() {
        return this.user !== null;
    }

    destroy() {
        // Cleanup
        if (this.auth) {
            this.signOut();
        }
        
        super.destroy();
    }
}