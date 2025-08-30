import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import './FishingGame.css';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import Keyboard from './Keyboard'
import Timer from './Timer';
import Confetti from 'react-confetti';
import Leaderboard from './Leaderboard';
import { getTranslation, getCurrentLanguage, Language } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Server API integration for secure game management

// Server API interfaces
interface PinGameRound {
  roundId: string;
  startTime: number;
  maxAttempts: number;
  duration: number;
}

interface GuessResponse {
  attemptNumber: number;
  guess: string;
  result: {
    correct: number;
    close: number;
  };
  isCompleted: boolean;
  isWon: boolean;
  attemptsRemaining: number;
  score: number;
  timestamp: number;
  secretCode?: string; // Only revealed when game is completed
}

interface Attempt {
  numbers: string[];
  result: 'correct' | 'partial' | 'wrong';
  feedback: string;
  serverResult?: {
    correct: number;
    close: number;
  };
}

interface PinGameProps {
  accountAddress?: string;
  user?: {
    id: number;
    username: string;
    walletAddress: string;
  } | null;
  hasUsername?: boolean;
}

const PinGame: React.FC<PinGameProps> = ({ accountAddress, user, hasUsername }) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  type Panel = {
    root: THREE.Object3D;
    numbersContainer: THREE.Object3D;
    digits: Record<string, THREE.Object3D[]>;
    clear: () => void;
    setDigit: (digit: string) => void;
  };
  const panelsRef = useRef<Panel[]>([]);
  const [guess, setGuess] = useState<string[]>(['', '', '', '']);
  const currentIndexRef = useRef<number>(0);
  const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<number>(0);
  
  // Server game state
  const [currentRound, setCurrentRound] = useState<PinGameRound | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [serverSecretCode, setServerSecretCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [finalScore, setFinalScore] = useState<number>(0);
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [hints, setHints] = useState<string[]>([]);
  const [showLanguageMenu, setShowLanguageMenu] = useState<boolean>(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('tr');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [tubeSequenceActive, setTubeSequenceActive] = useState<boolean>(false);
  const [winLights, setWinLights] = useState<THREE.PointLight[]>([]);
  const [showSocialMenu, setShowSocialMenu] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showBoardModel, setShowBoardModel] = useState<boolean>(false);
  const [boardModel, setBoardModel] = useState<THREE.Group | null>(null);
  const [originalModel, setOriginalModel] = useState<THREE.Group | null>(null);
  const [originalCameraPosition, setOriginalCameraPosition] = useState<THREE.Vector3 | null>(null);
  const [originalCameraTarget, setOriginalCameraTarget] = useState<THREE.Vector3 | null>(null);

  // Refs for cleanup
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set current language
  useEffect(() => {
    setCurrentLanguage(getCurrentLanguage());
  }, []);

  // Server API functions
  const startNewRound = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/pin-game/start-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include JWT cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start round');
      }

      const roundData: PinGameRound = await response.json();
      setCurrentRound(roundData);
      setGameStarted(true);
      setGameOver(false);
      setTimerActive(true);
      console.log('🎮 New round started:', roundData.roundId);
      
    } catch (error) {
      console.error('❌ Failed to start round:', error);
      setError(error instanceof Error ? error.message : 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  };

  // Simplified validation - no ticket needed for PIN game

  const submitGuess = async (guessCode: string) => {
    if (!currentRound) {
      setError('No active round');
      return;
    }

    try {
      setIsLoading(true);
      const timestamp = Date.now();

      const response = await fetch('/api/pin-game/check-guess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          roundId: currentRound.roundId,
          guess: guessCode,
          timestamp: timestamp,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit guess');
      }

      const guessResult: GuessResponse = await response.json();
      return guessResult;
      
    } catch (error) {
      console.error('❌ Failed to submit guess:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit guess');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Start new round on component mount or when user starts game
  useEffect(() => {
    if (user && hasUsername && !gameStarted) {
      startNewRound();
    }
  }, [user, hasUsername]);

  // Cursor blink effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Close social menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSocialMenu && !target.closest('[data-social-menu]')) {
        setShowSocialMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSocialMenu]);

  const handleTimeUp = () => {
    setGameOver(true);
    setTimerActive(false);
    if (serverSecretCode) {
      alert(`${getTranslation(currentLanguage, 'timeUpWithCode')} ${serverSecretCode}`);
    } else {
      alert(getTranslation(currentLanguage, 'timeUp'));
    }
    
    // End round on server
    if (currentRound) {
      endRound('timeout');
    }
  };

  const endRound = async (reason: string = 'completed') => {
    if (!currentRound) return;

    try {
      const response = await fetch('/api/pin-game/end-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          roundId: currentRound.roundId,
          reason: reason
        }),
      });

      if (response.ok) {
        const endData = await response.json();
        console.log('🏁 Round ended:', endData);
        setServerSecretCode(endData.secretCode || '');
      }
    } catch (error) {
      console.error('❌ Failed to end round:', error);
    }
  };

  const handleKeyPress = (key: string) => {
    if (gameOver) return;
    
    const idx = currentIndexRef.current;
    if (idx < 4) {
      const digit = key;
      
      // Başına 0 koymayı engelle
      if (idx === 0 && digit === '0') return;
      
      // Aynı sayıyı tekrar girmeyi engelle
      if (guess.includes(digit)) return;
      
      // Always use the same 4 tubes (0,1,2,3) for each attempt
      const tubeIndex = idx; // Use current digit position as tube index
      const p = panelsRef.current[tubeIndex];
      
      if (p) {
        // Clear and set the new digit
        p.clear();
        p.setDigit(digit);
        console.log('Set digit on tube:', digit);
      } else {
        console.log('Panel not found for tube index:', tubeIndex);
      }
      
      setGuess((prev) => {
        const next = [...prev];
        next[idx] = digit;
        return next;
      });
      
      currentIndexRef.current = Math.min(idx + 1, 4);
      setResult('idle');
    }
  };

  const handleDelete = () => {
    if (gameOver) return;
    
    let idx = currentIndexRef.current;
    if (idx === 0 && guess[0] === '') return;
    if (idx === 4 || guess[Math.max(idx - 1, 0)] !== '') idx = Math.max(idx - 1, 0);
    
    // Clear the specific tube
    const tubeIndex = idx; // Use digit position as tube index
    const p = panelsRef.current[tubeIndex];
    if (p) p.clear();
    
    setGuess((prev) => {
      const next = [...prev];
      next[idx] = '';
      return next;
    });
    
    currentIndexRef.current = idx;
    setResult('idle');
  };

  const handleEnter = async () => {
    if (gameOver || isLoading) return;
    
    const code = guess.join('');
    if (code.length < 4) return;
    
    // Submit guess to server
    const guessResult = await submitGuess(code);
    if (!guessResult) return; // Error already handled in submitGuess
    
    // Process server response
    const { result: serverResult, isCompleted, isWon, secretCode } = guessResult;
    
    // Generate hint from server result
    let hint = '';
    for (let i = 0; i < serverResult.correct; i++) {
        hint += '+';
    }
    for (let i = 0; i < serverResult.close; i++) {
        hint += '-';
    }
    
    // Add to hints array
    setHints(prev => [...prev, hint]);
    
    // Calculate feedback text
    let feedback = '';
    if (serverResult.correct === 4) {
      feedback = 'Doğru!';
      setResult('correct');
    } else if (serverResult.correct > 0 || serverResult.close > 0) {
      feedback = `${serverResult.correct} ${getTranslation(currentLanguage, 'correctPositions')}, ${serverResult.close} ${getTranslation(currentLanguage, 'correctNumbers')}`;
      setResult('wrong');
    } else {
      feedback = getTranslation(currentLanguage, 'noCorrect');
      setResult('wrong');
    }
    
    // Add to attempts
    const newAttempt: Attempt = {
      numbers: [...guess],
      result: isWon ? 'correct' : serverResult.correct > 0 || serverResult.close > 0 ? 'partial' : 'wrong',
      feedback,
      serverResult: serverResult
    };
    
    setAttempts(prev => [...prev, newAttempt]);
    setCurrentAttempt(prev => prev + 1);
    
    // Check game completion
    if (isCompleted) {
      setGameOver(true);
      setTimerActive(false);
      
      if (secretCode) {
        setServerSecretCode(secretCode);
        console.log(`🔍 DEBUG - Secret Code: ${secretCode}`); // Debug için
      }
      
      if (guessResult.score) {
        setFinalScore(guessResult.score);
      }
      
      if (isWon) {
      celebrateWin(); // Start confetti and tube sequence
        console.log(`🎉 ${getTranslation(currentLanguage, 'gameWon')} Score: ${guessResult.score} (blockchain güncellenmesi server-side yapılıyor)`);
      } else {
        console.log(`💥 ${getTranslation(currentLanguage, 'gameLost')}`);
        endRound('completed');
      }
    }
    
    // Clear current guess
    resetGuess();
  };

  const resetGuess = () => {
    // Clear all 4 tubes when starting a new attempt
    for (let i = 0; i < 4; i++) {
      if (panelsRef.current[i]) {
        panelsRef.current[i].clear();
      }
    }
    setGuess(['', '', '', '']);
    currentIndexRef.current = 0;
    setResult('idle');
  };

  const resetGame = () => {
    // End current round on server if exists
    if (currentRound) {
      endRound('abandoned');
    }
    
    // Clear any running celebration timers/intervals
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = null;
    }
    if (sequenceIntervalRef.current) {
      clearInterval(sequenceIntervalRef.current);
      sequenceIntervalRef.current = null;
    }
    
    // Reset all client state
    setGameOver(false);
    setAttempts([]);
    setCurrentAttempt(0);
    setTimerActive(false); // Will be set to true when new round starts
    setHints([]); // Clear hints
    setShowConfetti(false); // Stop confetti
    setTubeSequenceActive(false); // Stop tube sequence
    removeWinLights(); // Remove any existing lights
    setError(''); // Clear any errors
    setServerSecretCode(''); // Clear secret code
    setCurrentRound(null); // Clear current round
    setGameStarted(false); // Reset game started flag
    setFinalScore(0); // Reset final score
    
    // Remove board model if exists
    if (boardModel && sceneRef.current) {
      sceneRef.current.remove(boardModel);
      setBoardModel(null);
      setShowBoardModel(false);
    }
    
    // Reset camera to original position if it was moved
    if (originalCameraPosition && originalCameraTarget && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(originalCameraPosition);
      controlsRef.current.target.copy(originalCameraTarget);
      controlsRef.current.update();
    }
    
    resetGuess();
    
    // Start new round
    startNewRound();
  };

  // Win celebration function
  const celebrateWin = () => {
    setShowConfetti(true);
    setTubeSequenceActive(true);
    addWinLights(); // Add lights around pins
    loadBoardModel(); // Load board model
    animateCameraVictory(); // Start camera victory animation
    
    // Run tube sequence from 1 to 9, then 0
    let currentNumber = 1;
    const sequenceInterval = setInterval(() => {
      if (currentNumber <= 9) {
        // Set all 4 tubes to the same number
        for (let i = 0; i < 4; i++) {
          if (panelsRef.current[i]) {
            panelsRef.current[i].clear();
            panelsRef.current[i].setDigit(currentNumber.toString());
          }
        }
        currentNumber++;
      } else if (currentNumber === 10) {
        // Show 0,0,0,0 and keep it
        for (let i = 0; i < 4; i++) {
          if (panelsRef.current[i]) {
            panelsRef.current[i].clear();
            panelsRef.current[i].setDigit('0');
          }
        }
        currentNumber++;
        // Stop the sequence but keep 0,0,0,0 visible
        clearInterval(sequenceInterval);
        sequenceIntervalRef.current = null;
        
        // Stop confetti after 5 more seconds but keep 0,0,0,0
        celebrationTimeoutRef.current = setTimeout(() => {
          setShowConfetti(false);
          setTubeSequenceActive(false);
          removeWinLights(); // Remove lights
          celebrationTimeoutRef.current = null;
          // Don't clear the tubes - keep 0,0,0,0
        }, 5000); // 5 more seconds after showing 0
      }
    }, 1000); // Change number every 1000ms
    
    // Store interval ref for cleanup
    sequenceIntervalRef.current = sequenceInterval;
  };

  // Add win lights around pins
  const addWinLights = () => {
    if (!sceneRef.current) return;
    
    const lights: THREE.PointLight[] = [];
    
    if (showBoardModel && boardModel) {
      // Add lights around board model
      const boardBox = new THREE.Box3().setFromObject(boardModel);
      const boardCenter = new THREE.Vector3();
      boardBox.getCenter(boardCenter);
      
      // Create purple light
      const purpleLight = new THREE.PointLight(0x9C27B0, 2, 3);
      purpleLight.position.set(boardCenter.x + 0.5, boardCenter.y + 0.5, boardCenter.z);
      sceneRef.current.add(purpleLight);
      lights.push(purpleLight);
      
      // Create white light
      const whiteLight = new THREE.PointLight(0xFFFFFF, 1.5, 2.5);
      whiteLight.position.set(boardCenter.x - 0.5, boardCenter.y - 0.5, boardCenter.z);
      sceneRef.current.add(whiteLight);
      lights.push(whiteLight);
      
      // Create additional purple light on top
      const topPurpleLight = new THREE.PointLight(0x9C27B0, 1.8, 2.8);
      topPurpleLight.position.set(boardCenter.x, boardCenter.y + 1, boardCenter.z);
      sceneRef.current.add(topPurpleLight);
      lights.push(topPurpleLight);
    } else {
      // Add lights around each pin panel
      panelsRef.current.forEach((panel, index) => {
        // Get panel position
        const panelBox = new THREE.Box3().setFromObject(panel.root);
        const panelCenter = new THREE.Vector3();
        panelBox.getCenter(panelCenter);
        
        // Create purple light
        const purpleLight = new THREE.PointLight(0x9C27B0, 2, 3); // Purple color, intensity 2, distance 3
        purpleLight.position.set(panelCenter.x + 0.5, panelCenter.y + 0.5, panelCenter.z);
        sceneRef.current!.add(purpleLight);
        lights.push(purpleLight);
        
        // Create white light
        const whiteLight = new THREE.PointLight(0xFFFFFF, 1.5, 2.5); // White color, intensity 1.5, distance 2.5
        whiteLight.position.set(panelCenter.x - 0.5, panelCenter.y - 0.5, panelCenter.z);
        sceneRef.current!.add(whiteLight);
        lights.push(whiteLight);
        
        // Create additional purple light on top
        const topPurpleLight = new THREE.PointLight(0x9C27B0, 1.8, 2.8);
        topPurpleLight.position.set(panelCenter.x, panelCenter.y + 1, panelCenter.z);
        sceneRef.current!.add(topPurpleLight);
        lights.push(topPurpleLight);
      });
    }
    
    setWinLights(lights);
  };

  // Remove win lights
  const removeWinLights = () => {
    if (!sceneRef.current) return;
    
    winLights.forEach(light => {
      sceneRef.current!.remove(light);
      light.dispose();
    });
    setWinLights([]);
  };

  // Clear all tubes when game resets
  useEffect(() => {
    if (panelsRef.current.length > 0) {
      panelsRef.current.forEach((p) => p.clear());
    }
  }, [attempts.length === 0]);

  useEffect(() => {
    if (!containerRef.current) return;

    let container = containerRef.current;
    let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let composer: EffectComposer;
    let bloomPass: UnrealBloomPass;

    function init() {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      sceneRef.current = scene; // Set scene reference
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      cameraRef.current = camera; // Set camera reference
      camera.position.set(2.5, 10.0, 20.0);

      const ambient = new THREE.AmbientLight(0xffffff, 0.1);
      scene.add(ambient);
      const directional = new THREE.DirectionalLight(0xffffff, 1.1);
      directional.position.set(5, 10, 7);
      scene.add(directional);

      controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls; // Set controls reference
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const sunriseUrl = '/assets/textures/qwantani_dusk_2_puresky_4k.hdr';
      new RGBELoader().load(sunriseUrl, (texture) => {
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          scene.environment = envMap;
          scene.background = envMap;
          scene.backgroundIntensity = 0.2;
          scene.environmentIntensity = 0.04;
          texture.dispose();
          pmremGenerator.dispose();
        });


      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .2, 0.4, 0.0);
      composer.addPass(bloomPass);

      const loader = new GLTFLoader();
      
      // Add loading manager for better error handling
      const loadingManager = new THREE.LoadingManager();
      loadingManager.onLoad = () => {
        console.log('All resources loaded successfully');
        setModelLoaded(true);
        setModelError(null);
      };
      loadingManager.onError = (url) => {
        console.error('Error loading resource:', url);
        setModelError(`Resource loading failed: ${url}`);
      };
        
      loader.manager = loadingManager;
      
      console.log('Starting model load...');
      loader.load(
        '/assets/models/pin_without_board.glb',
        (gltf) => {
          const model = gltf.scene;
          
          // Count all objects for debugging
          let totalObjects = 0;
          let numObjects = 0;
          model.traverse((obj) => { 
            totalObjects++;
            if (obj.name.toLowerCase().startsWith('num')) {
              numObjects++;
            }
            obj.castShadow = true; 
            obj.receiveShadow = true; 
          });
          console.log(`Total objects in model: ${totalObjects}`);
          console.log(`Number objects found: ${numObjects}`);

          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          model.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0 && maxDim !== 1) {
            const scale = window.innerWidth < 768 ? 0.6 / maxDim : 2.0 / maxDim; // Mobile scale adjustment - even smaller
            model.scale.setScalar(scale);
          }

          // --- GERİ EKLENDİ ---: Rakamların materyallerine emissive (parlama) ekleyen bölüm.
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            const mat = (mesh.material as unknown) as THREE.Material | THREE.Material[];
            const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
            mats.forEach((m) => {
              const ms = m as THREE.MeshStandardMaterial;
              if ((ms as any).emissive !== undefined) {
                // Eğer nesne adı 'num' ile başlıyorsa veya emissive map'i varsa, parlama ekle
                if (obj.name.toLowerCase().startsWith('num') || (ms as any).emissiveMap) {
                  if (ms.emissive.equals(new THREE.Color(0x000000))) {
                    ms.emissive = new THREE.Color(0xff6a00); // Turuncu bir parlama rengi
                  }
                  (ms as any).emissiveIntensity = 2.2; // Parlama gücü
                  ms.needsUpdate = true;
                }
              }
            });
          });

          scene.add(model);
          setOriginalModel(model); // Save reference to original model
          
          try {
            const parentToNumChildren = new Map<THREE.Object3D, THREE.Object3D[]>();
            model.traverse((obj) => {
              const name = (obj.name || '').toLowerCase();
              if (name.startsWith('num') && !name.startsWith('number')) {
                const parent = obj.parent;
                if (parent) {
                  const arr = parentToNumChildren.get(parent) || [];
                  arr.push(obj);
                  parentToNumChildren.set(parent, arr);
                }
              }
            });

            
            let parentGroups = Array.from(parentToNumChildren.entries()).filter(([, arr]) => arr.length >= 11);
            
            const groupsWithCenter = parentGroups.map(([p, children]) => {
              const box = new THREE.Box3().setFromObject(p);
              const center = new THREE.Vector3();
              box.getCenter(center);
              return { entry: [p, children] as [THREE.Object3D, THREE.Object3D[]], x: center.x };
            });
            groupsWithCenter.sort((a, b) => a.x - b.x);
            parentGroups = groupsWithCenter.map((g) => g.entry);

            if (parentGroups.length > 4) parentGroups = parentGroups.slice(0, 4);

            const digitKeys = ['0','1','2','3','4','5','6','7','8','9','.'] as const;
            type DigitKey = typeof digitKeys[number];
            type DigitsMap = Record<DigitKey, THREE.Object3D[]>;

            const makeDigitsMap = (): DigitsMap => ({'0': [],'1': [],'2': [],'3': [],'4': [],'5': [],'6': [],'7': [],'8': [],'9': [],'.': []});

            const panels: Panel[] = parentGroups.map(([parent, children], index) => {
              const digitsMap: DigitsMap = makeDigitsMap();

              children.forEach((child) => {
                const n = (child.name || '').toLowerCase();
                let key: DigitKey = '.';
                const m = n.match(/^num(\d)/);
                if (n.includes('dot')) key = '.';
                else if (m && m[1]) key = (m[1] as DigitKey);
                digitsMap[key].push(child);
              });

              const setAll = (visible: boolean) => {(Object.values(digitsMap) as THREE.Object3D[][]).forEach((arr) => arr.forEach((o) => (o.visible = visible)));};
              setAll(false);

              return {
                root: parent,
                numbersContainer: parent,
                digits: digitsMap as unknown as Record<string, THREE.Object3D[]>,
                clear: () => {
                  setAll(false);
                },
                setDigit: (digit: string) => {
                  const dk: DigitKey = (digit === '.' || /^[0-9]$/.test(digit)) ? (digit as DigitKey) : '.';
                  (Object.entries(digitsMap) as [DigitKey, THREE.Object3D[]][]).forEach(([k, arr]) => {
                    arr.forEach((o) => {
                      const wasVisible = o.visible;
                      o.visible = k === dk;
                    });
                  });
                },
              };
            });
            panelsRef.current = panels;
            setModelLoaded(true);
            
            const frameOnObjects = (objects: THREE.Object3D[]) => {
              if (!objects.length) return;
              const box = new THREE.Box3();
              objects.forEach((o) => { o.updateWorldMatrix(true, false); box.expandByObject(o); });
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              box.getSize(size);
              box.getCenter(center);

              const maxDim = Math.max(size.x, size.y, size.z);
              const fitOffset = window.innerHeight < 1000 ? 1.7 : 1.5;
              const fov = camera.fov * (Math.PI / 180);
              const fitHeightDistance = (maxDim * fitOffset) / (2 * Math.tan(fov / 2));
              const fitWidthDistance = (maxDim * fitOffset) / (2 * Math.tan(Math.atan(Math.tan(fov / 2) * camera.aspect)));
              const distance = Math.max(fitHeightDistance, fitWidthDistance);

              // Position camera to focus on the center of all objects
              const isMobile = window.innerWidth < 768;
              const mobileDistance = distance; // Closer camera for mobile
              camera.position.set(center.x, center.y + mobileDistance * (isMobile ? -0 : -0.1), center.z + mobileDistance * (isMobile ? 0.8 : 1));
              controls.target.set(center.x, center.y + mobileDistance * (isMobile ? -0.3 : -0.3), center.z);
              camera.updateProjectionMatrix();
              controls.update();
            };
            const capsuleParents = parentGroups.map(([p]) => p);
            frameOnObjects(capsuleParents);

            const w = globalThis as any;
            w.setOnlyNumVisibleByPrefix = (prefix: string) => {
              const pref = (prefix || '').toLowerCase();
              model.traverse((obj) => {
                const n = (obj.name || '').toLowerCase();
                if (n.startsWith('num') && !n.startsWith('number')) {
                  obj.visible = n.startsWith(pref);
                }
              });
            };
            w.setAllNumVisible = (flag: boolean) => {
              model.traverse((obj) => {
                const n = (obj.name || '').toLowerCase();
                if (n.startsWith('num') && !n.startsWith('number')) {
                  obj.visible = !!flag;
                }
              });
            };
          } catch (err) { 
            console.error('Failed to build panels from model', err);
            setModelError(`Panel creation failed: ${err}`);
          }
        },
        (progress) => {
          console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => { 
          console.error('pin.glb yüklenirken hata:', error);
          setModelError(`Model loading failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      );
      window.addEventListener('resize', onWindowResize);
      renderer.setAnimationLoop(animate);
    }
    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    }
    function animate() {
      controls.update();
      if (composer) composer.render(); else renderer.render(scene, camera);
    }
    init();
    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (renderer) renderer.setAnimationLoop(null);
      if (container && renderer?.domElement) container.removeChild(renderer.domElement);
      if (renderer) renderer.dispose();
    };
  }, []);

  // Load board model function
  const loadBoardModel = () => {
    if (!sceneRef.current) return;
    
    const loader = new GLTFLoader();
    loader.load(
      '/assets/models/board.glb',
      (gltf) => {
        const model = gltf.scene;
        
        // Scale and position the board model
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0 && maxDim !== 1) {
          const scale = window.innerWidth < 768 ? 0.6 / maxDim : 2.18 / maxDim;
          model.scale.setScalar(scale);
        }
        
        // Add emissive materials to numbers
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          const mat = (mesh.material as unknown) as THREE.Material | THREE.Material[];
          const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
          mats.forEach((m) => {
            const ms = m as THREE.MeshStandardMaterial;
            if ((ms as any).emissive !== undefined) {
              if (obj.name.toLowerCase().startsWith('num') || (ms as any).emissiveMap) {
                if (ms.emissive.equals(new THREE.Color(0x000000))) {
                  ms.emissive = new THREE.Color(0xff6a00);
                }
                (ms as any).emissiveIntensity = 2.2;
                ms.needsUpdate = true;
              }
            }
          });
        });
        
        setBoardModel(model);
        if (sceneRef.current) {
          sceneRef.current.add(model);
        }
        setShowBoardModel(true);
        
        // Add lights around the board model
        setTimeout(() => {
          addWinLights();
        }, 100);
      },
      (progress) => {
        console.log('Board model loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
      },
      (error) => {
        console.error('Board model loading failed:', error);
      }
    );
  };

  // Camera victory animation
  const animateCameraVictory = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    // Save original camera position and target
    const originalPos = camera.position.clone();
    const originalTarget = controls.target.clone();
    setOriginalCameraPosition(originalPos);
    setOriginalCameraTarget(originalTarget);
    
    // Victory camera position (closer and more dramatic)
    const victoryPos = new THREE.Vector3(
      originalPos.x + 1, // Less right movement
      originalPos.y + 1, // Less upward movement
      originalPos.z - 1  // Less forward movement
    );
    
    // Victory target (focus on center)
    const victoryTarget = new THREE.Vector3(
      originalTarget.x,
      originalTarget.y + 0.5, // Less upward focus
      originalTarget.z
    );
    
    // Animate to victory position
    const duration = 2000; // 2 seconds
    const startTime = Date.now();
    
    const animateToVictory = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      camera.position.lerpVectors(originalPos, victoryPos, easeProgress);
      controls.target.lerpVectors(originalTarget, victoryTarget, easeProgress);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animateToVictory);
      } else {
        // After 3 seconds at victory position, return to original
        setTimeout(() => {
          animateBackToOriginal();
        }, 3000);
      }
    };
    
    const animateBackToOriginal = () => {
      const startTime = Date.now();
      
      const animateBack = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        camera.position.lerpVectors(victoryPos, originalPos, easeProgress);
        controls.target.lerpVectors(victoryTarget, originalTarget, easeProgress);
        controls.update();
        
        if (progress < 1) {
          requestAnimationFrame(animateBack);
        }
      };
      
      animateBack();
    };
    
    animateToVictory();
  };

  return (
    <div className="fishing-game" style={{ position: 'relative' }}>
      {/* Confetti Animation */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={true}
          numberOfPieces={250}
          gravity={0.3}
          colors={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']}
        />
      )}
      
      {/* Timer - Top Left */}
      <div style={{
        position: 'absolute',
        top: window.innerWidth < 768 ? '10px' : '20px',
        left: window.innerWidth < 768 ? '10px' : '20px',
        zIndex: 1000,
        fontFamily: 'Lucida Console, Courier New, monospace'
      }}>
        <Timer 
          key={`timer-${gameStarted}-${gameOver}`}
          initialTime={300}
          onTimeUp={handleTimeUp}
          isActive={timerActive && !gameOver}
        />
      </div>

      {/* Top Right Icons */}
      <div style={{
        position: 'absolute',
        top: window.innerWidth < 768 ? '10px' : '20px', // Mobile: closer to top
        right: window.innerWidth < 768 ? '10px' : '20px', // Mobile: closer to edge
        display: 'flex',
        gap: window.innerWidth < 768 ? '10px' : '15px', // Mobile: smaller gap
        zIndex: 1000,
        fontFamily: 'Lucida Console, Courier New, monospace'
      }}>
        {/* Leaderboard Icon */}
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          title={getTranslation(currentLanguage, 'leaderboardTooltip')}
          style={{
            width: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
            height: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid rgba(255,255,255,0.3)',
            color: '#fff',
            fontSize: window.innerWidth < 768 ? '16px' : '20px', // Mobile: smaller font
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ width: '24px', height: '24px' }}
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55.47.98.97 1.21C11.25 18.48 11.61 18.67 12 18.67s.75-.19 1.03-.46c.5-.23.97-.66.97-1.21v-2.34"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
        </button>

        {/* How to Play Icon */}
        <button
          onClick={() => setShowHowToPlay(!showHowToPlay)}
          title={getTranslation(currentLanguage, 'howToPlayTooltip')}
          style={{
            width: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
            height: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid rgba(255,255,255,0.3)',
            color: '#fff',
            fontSize: window.innerWidth < 768 ? '16px' : '20px', // Mobile: smaller font
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            style={{ width: '24px', height: '24px' }}
          >
            <g>
              <g>
                <path d="M17 9A5 5 0 0 0 7 9a1 1 0 0 0 2 0 3 3 0 1 1 3 3 1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-1.1A5 5 0 0 0 17 9z"></path>
                <circle cx="12" cy="19" r="1"></circle>
              </g>
            </g>
          </svg>
        </button>

        {/* Social Media/X Icon */}
        <div style={{ position: 'relative' }} data-social-menu>
          <button
            onClick={() => {
              window.open('https://x.com/semih_durgun', '_blank');
            }}
            style={{
              width: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
              height: window.innerWidth < 768 ? '35px' : '45px', // Mobile: smaller
              borderRadius: '50%',
              background: showSocialMenu ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(0,0,0,0.7)',
              border: showSocialMenu ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: window.innerWidth < 768 ? '14px' : '18px', // Mobile: smaller font
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              boxShadow: showSocialMenu ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (!showSocialMenu) {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showSocialMenu) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
              }
            }}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="currentColor"
              style={{ width: '20px', height: '20px' }}
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
        </div>

        {/* Language Icon */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            style={{
              width: window.innerWidth < 768 ? '35px' : '45px',
              height: window.innerWidth < 768 ? '35px' : '45px',
              borderRadius: '50%',
              background: showLanguageMenu ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(0,0,0,0.7)',
              border: showLanguageMenu ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.3)',
              color: '#fff',
              fontSize: window.innerWidth < 768 ? '14px' : '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: showLanguageMenu ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none',
              fontFamily: 'Arial, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (!showLanguageMenu) {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!showLanguageMenu) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
              }
            }}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 512 512" 
              fill="currentColor"
              style={{ width: '20px', height: '20px' }}
            >
              <path d="M256 48C141.124 48 48 141.125 48 256s93.124 208 208 208c114.875 0 208-93.125 208-208S370.875 48 256 48zm-21.549 384.999c-39.464-4.726-75.978-22.392-104.519-50.932C96.258 348.393 77.714 303.622 77.714 256c0-42.87 15.036-83.424 42.601-115.659.71 8.517 2.463 17.648 2.014 24.175-1.64 23.795-3.988 38.687 9.94 58.762 5.426 7.819 6.759 19.028 9.4 28.078 2.583 8.854 12.902 13.498 20.019 18.953 14.359 11.009 28.096 23.805 43.322 33.494 10.049 6.395 16.326 9.576 13.383 21.839-2.367 9.862-3.028 15.937-8.13 24.723-1.557 2.681 5.877 19.918 8.351 22.392 7.498 7.497 14.938 14.375 23.111 21.125 12.671 10.469-1.231 24.072-7.274 39.117zm147.616-50.932c-25.633 25.633-57.699 42.486-92.556 49.081 4.94-12.216 13.736-23.07 21.895-29.362 7.097-5.476 15.986-16.009 19.693-24.352 3.704-8.332 8.611-15.555 13.577-23.217 7.065-10.899-17.419-27.336-25.353-30.781-17.854-7.751-31.294-18.21-47.161-29.375-11.305-7.954-34.257 4.154-47.02-1.417-17.481-7.633-31.883-20.896-47.078-32.339-15.68-11.809-14.922-25.576-14.922-42.997 12.282.453 29.754-3.399 37.908 6.478 2.573 3.117 11.42 17.042 17.342 12.094 4.838-4.043-3.585-20.249-5.212-24.059-5.005-11.715 11.404-16.284 19.803-24.228 10.96-10.364 34.47-26.618 32.612-34.047s-23.524-28.477-36.249-25.193c-1.907.492-18.697 18.097-21.941 20.859.086-5.746.172-11.491.26-17.237.055-3.628-6.768-7.352-6.451-9.692.8-5.914 17.262-16.647 21.357-21.357-2.869-1.793-12.659-10.202-15.622-8.968-7.174 2.99-15.276 5.05-22.45 8.039 0-2.488-.302-4.825-.662-7.133a176.585 176.585 0 0 1 45.31-13.152l14.084 5.66 9.944 11.801 9.924 10.233 8.675 2.795 13.779-12.995L282 87.929V79.59c27.25 3.958 52.984 14.124 75.522 29.8-4.032.361-8.463.954-13.462 1.59-2.065-1.22-4.714-1.774-6.965-2.623 6.531 14.042 13.343 27.89 20.264 41.746 7.393 14.801 23.793 30.677 26.673 46.301 3.394 18.416 1.039 35.144 2.896 56.811 1.788 20.865 23.524 44.572 23.524 44.572s10.037 3.419 18.384 2.228c-7.781 30.783-23.733 59.014-46.769 82.052z"/>
            </svg>
          </button>

          {/* Language Menu */}
          {showLanguageMenu && (
            <div style={{
              position: 'absolute',
              top: '55px',
              right: '0',
              borderRadius: '20px',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '80px',
              backdropFilter: 'blur(10px)',
            }}>
              {['TR', 'EN', 'ZH', 'AR', 'JP'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setCurrentLanguage(lang.toLowerCase() as Language);
                    setShowLanguageMenu(false);
                  }}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: currentLanguage === lang.toLowerCase() ? 'linear-gradient(135deg, #9C27B0, #7B1FA2)' : 'rgba(255,255,255,0.1)',
                    border: currentLanguage === lang.toLowerCase() ? '3px solid #9C27B0' : '2px solid rgba(255,255,255,0.3)',
                    color: currentLanguage === lang.toLowerCase() ? '#fff' : '#ccc',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: currentLanguage === lang.toLowerCase() ? 'bold' : 'normal',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}
                  onMouseEnter={(e) => {
                    if (currentLanguage !== lang.toLowerCase()) {
                      e.currentTarget.style.background = 'rgba(156, 39, 176, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.borderColor = '#9C27B0';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentLanguage !== lang.toLowerCase()) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.color = '#ccc';
                    }
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 2000,
          animation: 'fadeIn 0.3s ease-out',
          padding: window.innerHeight < 1000 ? '20px' : '0'
        }}>
          <div style={{
            background: 'rgba(20,20,20,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: window.innerHeight < 1000 ? '80vh' : 'auto',
            overflowY: window.innerHeight < 1000 ? 'auto' : 'visible',
            marginTop: '50px',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontFamily: 'Lucida Console, Courier New, monospace',
            animation: 'slideDown 0.4s ease-out',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowHowToPlay(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              ×
            </button>

            {/* Header */}
            <h2 style={{ 
              margin: '0 0 30px 0', 
              fontSize: '28px',
              fontWeight: 'bold',
              textAlign: 'center',
              color: '#fff'
            }}>
              {getTranslation(currentLanguage, 'howToPlay')}
            </h2>

            {/* Main Rules */}
            <div style={{ marginBottom: '30px' }}>
              <p style={{ 
                margin: '0 0 15px 0', 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#ccc'
              }}>
                <strong style={{ color: '#fff' }}>{getTranslation(currentLanguage, 'findNumber')}</strong> {getTranslation(currentLanguage, 'findNumberDesc')}
              </p>
              <p style={{ 
                margin: '0 0 15px 0', 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#ccc'
              }}>
                {getTranslation(currentLanguage, 'guessDesc')}
              </p>
              <p style={{ 
                margin: '0 0 15px 0', 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#ccc'
              }}>
                {getTranslation(currentLanguage, 'playDesc')}
              </p>
              <p style={{ 
                margin: '0 0 20px 0', 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#ccc'
              }}>
                {getTranslation(currentLanguage, 'feedbackDesc')}
              </p>
            </div>

            {/* Separator */}
            <div style={{
              width: '100%',
              height: '1px',
              background: 'rgba(255,255,255,0.3)',
              margin: '25px 0'
            }} />

            {/* Examples Section */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {getTranslation(currentLanguage, 'examples')}
              </h3>

              {/* Example 1: All wrong */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '20px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  {/* No dots - all wrong */}
                </div>
                <span style={{ fontSize: '16px', color: '#ccc' }}>
                  {getTranslation(currentLanguage, 'wrongNumbers')}
                </span>
              </div>

              {/* Example 2: Mixed */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '20px'
              }}>
                <div style={{
                  width: '74px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '2px solid #9C27B0' 
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '2px solid #FFC107'
                  }} />
                </div>
                <span style={{ fontSize: '16px', color: '#ccc' }}>
                  {getTranslation(currentLanguage, 'mixedNumbers')}
                </span>
              </div>

              {/* Example 3: Three correct */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '20px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '2px solid #9C27B0'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '2px solid #9C27B0'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '2px solid #9C27B0'
                  }} />
                </div>
                <span style={{ fontSize: '16px', color: '#ccc' }}>
                  {getTranslation(currentLanguage, 'threeCorrect')}
                </span>
              </div>
            </div>

            {/* Hint Legend */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ 
                margin: '0 0 15px 0', 
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {getTranslation(currentLanguage, 'hintColors')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid #9C27B0'
                  }} />
                  <span style={{ fontSize: '14px', color: '#ccc' }}>
                    {getTranslation(currentLanguage, 'purpleDot')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid #FFC107'
                  }} />
                  <span style={{ fontSize: '14px', color: '#ccc' }}>
                    {getTranslation(currentLanguage, 'yellowDot')}
                  </span>
                </div>
              </div>
            </div>

            {/* Additional Tips */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ 
                margin: '0 0 15px 0', 
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#fff'
              }}>
                {getTranslation(currentLanguage, 'strategyTips')}
              </h3>
              <ul style={{ 
                margin: '0', 
                paddingLeft: '20px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#bbb'
              }}>
                <li style={{ marginBottom: '8px' }}>
                  {getTranslation(currentLanguage, 'startDifferent')}
                </li>
                <li style={{ marginBottom: '8px' }}>
                  {getTranslation(currentLanguage, 'payAttention')}
                </li>
                <li style={{ marginBottom: '8px' }}>
                  {getTranslation(currentLanguage, 'useElimination')}
                </li>
                <li style={{ marginBottom: '8px' }}>
                  {getTranslation(currentLanguage, 'planWisely')}
                </li>
              </ul>
            </div>

            {/* Footer */}
            <div style={{
              fontSize: '12px',
              color: '#666',
              textAlign: 'center',
              marginBottom: '25px'
            }}>
              {getTranslation(currentLanguage, 'madeBy')}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      <Leaderboard 
        isOpen={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)}
        language={currentLanguage}
      />

      {/* 3D Container - Fixed to top */}
      <div ref={containerRef} id="container" style={{ 
        width: '100%', 
        height: '70%', // Mobile: 50%, Desktop: 70%
        position: 'absolute',
        top: 0,
        left: 0
      }} />
      
      {/* Bottom Section - Attempts and Keyboard */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: window.innerWidth < 768 ? '70%' : '30%', // Mobile: 50%, Desktop: 30%
        display: 'flex',
        flexDirection: window.innerWidth < 768 ? 'column' : 'row', // Mobile: column, Desktop: row
        justifyContent: 'center',
        alignItems: 'center',
        gap: window.innerWidth < 768 ? '1rem' : '8rem', // Mobile: smaller gap
        padding: window.innerWidth < 768 ? '1rem' : '18rem', // Mobile: smaller padding
        fontFamily: 'Lucida Console, Courier New, monospace',
        pointerEvents: 'none' // Allow mouse events to pass through to 3D scene
      }}>
        
        {/* Left Side - Attempts */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px',
          minWidth: window.innerWidth < 768 ? 'auto' : '300px', // Mobile: auto width
          marginRight: window.innerWidth < 768 ? '0' : '40px', // Mobile: no margin
          fontFamily: 'Lucida Console, Courier New, monospace',
          width: window.innerWidth < 768 ? '100%' : 'auto', // Mobile: full width
          pointerEvents: 'auto' // Make attempts section interactive
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'Lucida Console, Courier New, monospace'
          }}>
         
            
          </div>
          
          {/* Attempts Grid */}
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            alignItems: 'flex-start',
            fontFamily: 'Lucida Console, Courier New, monospace'
          }}>
            {/* Numbers Grid */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '8px',
              fontFamily: 'Lucida Console, Courier New, monospace'
            }}>
              {Array.from({ length: 8 }, (_, rowIndex) => (
                <div key={rowIndex} style={{ 
                  display: 'flex', 
                  gap: '6px'
                }}>
                  {Array.from({ length: 4 }, (_, colIndex) => {
                    const attempt = attempts[rowIndex];
                    const isCurrentRow = rowIndex === currentAttempt;
                    const isCurrentCell = isCurrentRow && colIndex === currentIndexRef.current;
                    const isEmpty = isCurrentRow && guess[colIndex] === '';
                    
                    // Get the number to display
                    let displayNumber = '';
                    if (attempt) {
                      displayNumber = attempt.numbers[colIndex] || '';
                    } else if (isCurrentRow) {
                      displayNumber = guess[colIndex] || '';
                    }
                    
                    return (
                      <div key={colIndex} style={{ 
                        width: window.innerWidth < 768 ? '40px' : '60px', // Mobile: smaller
                        height: window.innerWidth < 768 ? '40px' : '60px', // Mobile: smaller
                        borderRadius: '8px', 
                        background: isCurrentCell ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: '700', 
                        fontSize: window.innerWidth < 768 ? '1rem' : '1.3rem', // Mobile: smaller font
                        border: isCurrentCell ? '2px solidrgb(101, 100, 120)' : '1px solid rgba(255,255,255,0.3)',
                        color: '#fff',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        fontFamily: 'Lucida Console, Courier New, monospace'
                      }}>
                        {displayNumber || (isCurrentRow && isEmpty && cursorVisible && colIndex === currentIndexRef.current ? (
                          <div style={{
                            width: '2px',
                            height: '20px',
                            background: '#fff',
                            animation: 'blink 1s infinite'
                          }} />
                        ) : '')}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* Feedback Circles */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '8px',
              marginLeft: '10px',
              fontFamily: 'Lucida Console, Courier New, monospace'
            }}>
              {Array.from({ length: 8 }, (_, rowIndex) => {
                const attempt = attempts[rowIndex];
                const hint = hints[rowIndex];
                
                return (
                  <div key={rowIndex} style={{ 
                    width: window.innerWidth < 768 ? '40px' : '60px', // Mobile: smaller
                    height: window.innerWidth < 768 ? '40px' : '60px', // Mobile: smaller
                    borderRadius: '50%', 
                    border: '2px solid rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    position: 'relative',
                    gap: '2px'
                  }}>
                    {hint && [...hint].map((sign, j) => {
                      switch(sign) {
                        case "+":
                          return <div key={j} style={{
                            width: window.innerWidth < 768 ? '6px' : '9px', // Mobile: smaller
                            height: window.innerWidth < 768 ? '6px' : '9px', // Mobile: smaller
                            borderRadius: '50%',
                            border: '2px solid #9c27b0'
                          }} />;
                        case "-":
                          return <div key={j} style={{
                            width: window.innerWidth < 768 ? '6px' : '9px', // Mobile: smaller
                            height: window.innerWidth < 768 ? '6px' : '9px', // Mobile: smaller
                            borderRadius: '50%',
                            border: '2px solid #FFC107'
                          }} />;
                        default:
                          return null;
                      }
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          
          {result !== 'idle' && !isLoading && (
            <div style={{ 
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '14px',
              color: result === 'correct' ? '#9c27b0' : '#FF5722',
              fontFamily: 'Lucida Console, Courier New, monospace'
            }}>
              {result === 'correct' ? getTranslation(currentLanguage, 'correct') : getTranslation(currentLanguage, 'wrong')}
            </div>
          )}
        </div>
        
        {/* Right Side - Keyboard or Game Results */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'Lucida Console, Courier New, monospace',
          width: window.innerWidth < 768 ? '100%' : 'auto', // Mobile: full width
          pointerEvents: 'none' // Allow mouse events to pass through to 3D scene
        }}>
          {gameOver ? (
            /* Simple Game Over Modal */
            <div style={{ 
              pointerEvents: 'auto',
              textAlign: 'center',
              padding: '30px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              minWidth: '300px',
              maxWidth: '350px'
            }}>
              {/* Result Title */}
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: result === 'correct' ? '#9c27b0' : '#ef4444',
                marginBottom: '20px'
              }}>
                {result === 'correct' ? getTranslation(currentLanguage, 'youWin') : getTranslation(currentLanguage, 'gameOver')}
              </div>
              
              {/* Score */}
              <div style={{
                fontSize: '18px',
                color: '#fff',
                marginBottom: '15px'
              }}>
                {getTranslation(currentLanguage, 'score')}: <span style={{ color: result === 'correct' ? '#9c27b0' : '#ef4444', fontWeight: 'bold' }}>
                  {finalScore > 0 ? finalScore : (result === 'correct' ? '1000+' : '0')}
                </span>
              </div>
              
              {/* Secret Code */}
              {serverSecretCode && (
                <div style={{
                  fontSize: '16px',
                  color: '#ccc',
                  marginBottom: '15px'
                }}>
                  {getTranslation(currentLanguage, 'secretCode')}: <span style={{ color: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }}>{serverSecretCode}</span>
                </div>
              )}
              
              {/* Attempts Used */}
              <div style={{
                fontSize: '14px',
                color: '#999',
                marginBottom: '25px'
              }}>
                {currentAttempt} / 8 deneme kullanıldı
              </div>
              
              {/* New Game Button */}
              <button 
                onClick={resetGame} 
                style={{ 
                  padding: '12px 24px',
                  background: '#9c27b0',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                {getTranslation(currentLanguage, 'newGame')}
              </button>
            </div>
          ) : (
            /* Active Game - Keyboard */
          <div style={{ pointerEvents: 'auto' }}> {/* Make keyboard buttons clickable */}
            <Keyboard
              onKeyPress={handleKeyPress}
              onEnter={handleEnter}
              onDelete={handleDelete}
              disabled={gameOver}
              maxLength={4}
              currentLength={guess.filter(g => g !== '').length}
            />
          </div>
          )}
        </div>
      </div>

      {/* Blink Animation CSS */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>

      {/* Animation Styles */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideDown {
            from { 
              opacity: 0;
              transform: translateY(-50px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      {/* Exit Button - Bottom Left */}
      <div style={{
        position: 'absolute',
        bottom: window.innerWidth < 768 ? '20px' : '30px',
        left: window.innerWidth < 768 ? '20px' : '30px',
        zIndex: 1000,
        fontFamily: 'Lucida Console, Courier New, monospace'
      }}>
        <button
          onClick={() => router.push('/')}
          title="Ana Sayfaya Dön"
          style={{
            width: window.innerWidth < 768 ? '50px' : '60px', // Slightly larger than top buttons
            height: window.innerWidth < 768 ? '50px' : '60px', // Slightly larger than top buttons
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.8)',
            border: '2px solid rgba(255,255,255,0.4)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)';
            e.currentTarget.style.background = 'rgba(0,0,0,0.9)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
            e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
          }}
        >
          <ArrowLeft size={window.innerWidth < 768 ? 20 : 24} />
        </button>
      </div>

      {/* Model Status */}
      {modelError && (
        <div style={{ 
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '12px',
          color: '#FF5722',
          fontFamily: 'Lucida Console, Courier New, monospace',
          marginTop: '10px'
        }}>
          Model Error: {modelError}
        </div>
      )}
      
      {!modelLoaded && !modelError && (
        <div style={{ 
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '12px',
          color: '#FFD700',
          fontFamily: 'Lucida Console, Courier New, monospace',
          marginTop: '10px'
        }}>
          Loading 3D Model...
        </div>
      )}
    </div>
  );
};

export default PinGame;