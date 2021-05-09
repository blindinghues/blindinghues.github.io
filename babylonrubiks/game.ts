class Playground {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        // This creates a basic Babylon Scene object (non-mesh)
        var scene = new BABYLON.Scene(engine);

        const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("textures/environment.dds", scene);
        scene.environmentTexture = hdrTexture;
        scene.createDefaultSkybox(scene.environmentTexture);

        scene.ambientColor = new BABYLON.Color3(0.5, 0.5, 0.5);

        scene.clearColor = new BABYLON.Color4(0.3, 0.3, 0.3, 1.0);

        // This creates and positions a free camera (non-mesh)
        var camera = new BABYLON.ArcRotateCamera("Camera", 0, Math.PI / 2, 10, new BABYLON.Vector3(0, 0, 0), scene);
        // This targets the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // Create GUI
        const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('');
        gui.idealHeight = 1080;

        function getRandomElementFromArray<T>(arr: Array<T>) : T {
            console.assert(arr.length != 0);
            return arr[Math.floor(arr.length * Math.random())];
        }

        class RotationAxis {
            public constructor(component: string) {
                this.component = component;
            }
            public getComponent(): string { return this.component; }
            public static Pitch = new RotationAxis('x');
            public static Yaw = new RotationAxis('y');
            public static Roll = new RotationAxis('z');
            private component: string;
        }

        class RubiksCube {
            public constructor() {
                this.transformNode = new BABYLON.TransformNode('', scene);

                this.createCubes();
                this.setupDragCallbacks();
                this.loadSounds();
            }

            public initEvents() {
                this.setMoves(this.moves);
                this.setTime(0);
            }

            private loadSounds() {
                for (let i = 1; i <= 14; i++) {
                    this.rotateSounds.push(
                        new BABYLON.Sound('', `sounds/rotations/${i}.ogg`, scene, null, {
                            loop: false,
                            autoplay: false
                        })
                    )
                }
            }

            private createCubes() {
                const blackBoxMaterial: BABYLON.StandardMaterial = new BABYLON.StandardMaterial('', scene);
                blackBoxMaterial.diffuseColor = BABYLON.Color3.Black();
     
                // create 3*3*3 cube grid
                for (let x = -1; x <= 1; x++) {
                    for (let z = -1; z <= 1; z++) {
                        for (let y = -1; y <= 1; y++) {
                            // create cube at x,y,z
                            const cube: BABYLON.Mesh = BABYLON.MeshBuilder.CreateBox('', {size: 1}, scene);
                            cube.position = new BABYLON.Vector3(x, y, z);
                            cube.material = blackBoxMaterial;
                            this.cubes.push(cube);
                            cube.parent = this.transformNode;
                        }
                    }
                }

                // create plane faces
                const sidePlaneDetails = [ 
                    {   color: new BABYLON.Color3(255 / 255, 255 / 255, 255 / 255), material: null,
                        rotation: new BABYLON.Vector3(Math.PI / 2, 0, 0), positionOffset: new BABYLON.Vector3(0, 1, 0)
                    }, {color: new BABYLON.Color3(255 / 255, 213 / 255, 0 / 255), material: null,
                        rotation: new BABYLON.Vector3(-Math.PI / 2, 0, 0), positionOffset: new BABYLON.Vector3(0, -1, 0)
                    }, {color: new BABYLON.Color3(0 / 255, 70 / 255, 173 / 255), material: null,
                        rotation: new BABYLON.Vector3(0, -Math.PI / 2, 0), positionOffset: new BABYLON.Vector3(1, 0, 0)
                    }, {color: new BABYLON.Color3(0 / 255, 155 / 255, 72 / 255), material: null,
                        rotation: new BABYLON.Vector3(0, Math.PI / 2, 0), positionOffset: new BABYLON.Vector3(-1, 0, 0)
                    }, {color: new BABYLON.Color3(255 / 255, 88 / 255, 0 / 255), material: null,
                        rotation: new BABYLON.Vector3(Math.PI, 0, 0), positionOffset: new BABYLON.Vector3(0, 0, 1)
                    }, {color: new BABYLON.Color3(183 / 255, 18 / 255, 52 / 255), material: null,
                        rotation: new BABYLON.Vector3(0, 0, 0), positionOffset: new BABYLON.Vector3(0, 0, -1)
                    }
                ].map(planeDetails => {
                    const pbr = new BABYLON.PBRMaterial("pbr", scene);

                    pbr.metallic = 0.0;
                    pbr.roughness = 0.5;    
                    pbr.albedoColor = planeDetails.color;
                    pbr.sheen.isEnabled = true;
                    pbr.reflectionTexture = hdrTexture;
                    planeDetails.material = pbr;
                    return planeDetails;
                });

                sidePlaneDetails.forEach(planeDetails => {
                    this.cubes
                        .filter(cube => cube.position.asArray().some((val, idx) => val != 0 && val == planeDetails.positionOffset.asArray()[idx]))
                        .forEach(cube => {
                            const planeMesh: BABYLON.Mesh = BABYLON.MeshBuilder.CreatePlane('', {size: 0.96}, scene);
                            planeMesh.isPickable = true;
                            planeMesh.parent = cube;
                            planeMesh.material = planeDetails.material;
                            planeMesh.position = planeDetails.positionOffset.scale(0.5001).clone();
                            planeMesh.rotation = planeDetails.rotation.clone();
                            this.sidePlaneToCubeMesh.set(planeMesh, cube);
                            if (!this.materialToSidePlanes.has(planeDetails.material))
                                this.materialToSidePlanes.set(planeDetails.material, []);
                            this.materialToSidePlanes.get(planeDetails.material).push(planeMesh);
                        });
                });
            }
            private setupDragCallbacks() {
                let firstPick: BABYLON.AbstractMesh = null;
                scene.onPointerObservable.add(eventData => {
                    if (!this.enabled)
                        return;
                    switch(eventData.type) {
                        case BABYLON.PointerEventTypes.POINTERDOWN:
                            firstPick = scene.pick(scene.pointerX, scene.pointerY).pickedMesh;
                            if (firstPick)
                                camera.detachControl(canvas);
                            break;
                        case BABYLON.PointerEventTypes.POINTERUP:
                            firstPick = null;
                            camera.attachControl(canvas);
                            break;
                        case BABYLON.PointerEventTypes.POINTERMOVE:
                            let potentialSecondPick: BABYLON.AbstractMesh = scene.pick(scene.pointerX, scene.pointerY).pickedMesh;
                            if (firstPick != null && potentialSecondPick != null && potentialSecondPick != firstPick
                                && this.sidePlaneToCubeMesh.has(firstPick) && this.sidePlaneToCubeMesh.has(potentialSecondPick)
                            ) {
                                const cubePosition: BABYLON.Vector3 = this.relativeToMe(this.sidePlaneToCubeMesh.get(firstPick).absolutePosition);
                                cubePosition.x = Math.round(cubePosition.x);
                                cubePosition.y = Math.round(cubePosition.y);
                                cubePosition.z = Math.round(cubePosition.z);
                                const planeDiff: BABYLON.Vector3 = this.relativeToMe(potentialSecondPick.absolutePosition)
                                    .subtract(this.relativeToMe(firstPick.absolutePosition));
                                const planeNormal = this.relativeToMe(firstPick.absolutePosition)
                                    .subtract(this.relativeToMe(this.sidePlaneToCubeMesh.get(firstPick).absolutePosition));

                                for (let i = 0; i <= 1; i++) {
                                    let positiveX = i == 0;
                                    if (!(positiveX ? (planeNormal.x >= 0.5) : (planeNormal.x <= -0.5)))
                                        continue;
                                    if (Math.abs(planeDiff.y) <= 0.1)
                                        this.rotate(RotationAxis.Yaw, Math.floor(cubePosition.y), positiveX ? planeDiff.z < 0 : planeDiff.z > 0);
                                    else
                                        this.rotate(RotationAxis.Roll, Math.floor(cubePosition.z), positiveX ? planeDiff.y > 0: planeDiff.y < 0);
                                }
                                for (let i = 0; i <= 1; i++) {
                                    let positiveY = i == 0;
                                    if (!(positiveY ? (planeNormal.y >= 0.5) : (planeNormal.y <= -0.5)))
                                        continue;
                                    if (Math.abs(planeDiff.x) <= 0.1)
                                        this.rotate(RotationAxis.Pitch, Math.floor(cubePosition.x), positiveY ? planeDiff.z > 0 : planeDiff.z < 0);
                                    else
                                        this.rotate(RotationAxis.Roll, Math.floor(cubePosition.z), positiveY ? planeDiff.x < 0: planeDiff.x > 0);
                                }
                                for (let i = 0; i <= 1; i++) {
                                    let positiveZ = i == 0;
                                    if (!(positiveZ ? (planeNormal.z >= 0.5) : (planeNormal.z <= -0.5)))
                                        continue;
                                    if (Math.abs(planeDiff.y) <= 0.1) 
                                        this.rotate(RotationAxis.Yaw, Math.floor(cubePosition.y), positiveZ ? planeDiff.x > 0 : planeDiff.x < 0);
                                    else
                                        this.rotate(RotationAxis.Pitch, Math.floor(cubePosition.x), positiveZ ? planeDiff.y < 0: planeDiff.y > 0);
                                }

                                firstPick = null;
                            }
                        break;
                    }
                });
            }

            public shuffle(onFinished?: () => void) {
                this.setMoves(0);
                if (this.timeUpdateHandle) {
                    clearInterval(this.timeUpdateHandle);
                    this.timeUpdateHandle = null;
                }
                this.enabled = false;
                this.shuffling = true;
                const axisOptions: Array<RotationAxis> = [RotationAxis.Yaw, RotationAxis.Pitch, RotationAxis.Roll];
                const ccwOptions: Array<boolean> = [true, false];
                const layerOptions: Array<number> = [-1, 0, 1];
                let movementCount: number = 100;
                const randomRotationInterval = setInterval(() => {
                    if (--movementCount == 0) {
                        clearInterval(randomRotationInterval);
                        this.enabled = true;
                        this.shuffling = false;
                        this.startTime = new Date();
                        this.timeUpdateHandle = setInterval(() => {
                            this.setTime((new Date()).getTime() - this.startTime.getTime());
                        }, 32);
                        if (onFinished)
                            onFinished();
                        return;
                    }
                    rubiksCube.rotate(
                        getRandomElementFromArray(axisOptions),
                        getRandomElementFromArray(layerOptions),
                        getRandomElementFromArray(ccwOptions),
                        4
                    );
                }, 50);
            }

            private relativeToMe(position: BABYLON.Vector3) {
                return BABYLON.Vector3.TransformCoordinates(position, this.transformNode.getWorldMatrix().clone().invert());
            }

            public getTransformNode(): BABYLON.TransformNode { return this.transformNode; }

            public rotate(axis: RotationAxis, layer: number, ccw: boolean, speedModifier? : number): boolean {
                console.assert(layer == -1 || layer == 0 || layer == 1);
                speedModifier = speedModifier === undefined ? 1: speedModifier;

                // determine cubes to rotate
                const cubesToRotate: Array<BABYLON.Mesh> = this.cubes
                .filter((cube) => !this.animatingCubes.has(cube))
                .filter((cube) => {
                    const relativeCubePos: BABYLON.Vector3 = cube.position;
                    switch(axis) {
                        case RotationAxis.Roll: return relativeCubePos.z == layer;
                        case RotationAxis.Yaw: return relativeCubePos.y == layer;
                        case RotationAxis.Pitch: return relativeCubePos.x == layer;
                    }
                });
                
                if (cubesToRotate.length != 9) {
                    return false;
                }
                cubesToRotate.forEach(cube => this.animatingCubes.add(cube));

                // parent cubes to transform node and rotate it
                const rotationInRadians: number = Math.PI * 0.5 * (ccw? 1 : -1);
                const transformNode = new BABYLON.TransformNode('', scene);
                transformNode.position = new BABYLON.Vector3(
                    axis == RotationAxis.Pitch ? layer : 0,
                    axis == RotationAxis.Yaw ? layer : 0,
                    axis == RotationAxis.Roll ? layer : 0
                );
                transformNode.parent = this.transformNode;
                cubesToRotate.forEach(cube => cube.setParent(transformNode));
                const animation = BABYLON.Animation.CreateAndStartAnimation('', transformNode, `rotation.${axis.getComponent()}`,
                    60, 15 / speedModifier, 0, rotationInRadians, 0);

                // play sound effect
                getRandomElementFromArray(this.rotateSounds).play();

                // when the animation is finished, unparent cubes from transform node
                animation.onAnimationEnd = () => {
                    cubesToRotate.forEach(cube => {
                        cube.setParent(this.transformNode);
                        cube.position.x = Math.round(cube.position.x);
                        cube.position.y = Math.round(cube.position.y);
                        cube.position.z = Math.round(cube.position.z);
                    });
                    transformNode.dispose();
                    cubesToRotate.forEach(cube => this.animatingCubes.delete(cube));
                    if (!this.shuffling && this.isSolved()) {
                        this.gameOver();
                    }
                };
                
                this.setMoves(this.moves + 1);

                return true;
            }

            public isSolved(): boolean {
                let valid: boolean = true;
                this.materialToSidePlanes.forEach((planes, material) => {
                    const cubePositions = planes.map(plane => this.sidePlaneToCubeMesh.get(plane).position);
                    valid = valid && (cubePositions.every(cubePos => cubePos.x == cubePositions[0].x) ||
                        cubePositions.every(cubePos => cubePos.y == cubePositions[0].y) || 
                        cubePositions.every(cubePos => cubePos.z == cubePositions[0].z));
                });
                return valid;
            }

            private gameOver() {
                this.enabled = false;
                clearInterval(this.timeUpdateHandle);
                this.onGameEnd.notifyObservers();
            }

            protected setMoves(moves: number) {
                if (this.shuffling)
                    return;
                this.moves = moves;
                this.onMoveMade.notifyObservers(this.moves);
            }
            protected setTime(timeInMS: number) {
                const timeString: string = new Date(timeInMS).toISOString().substr(11, 8);
                this.onClockTick.notifyObservers(timeString);
            }

            public onMoveMade: BABYLON.Observable<number> = new BABYLON.Observable();
            public onClockTick: BABYLON.Observable<string> = new BABYLON.Observable();
            public onGameEnd: BABYLON.Observable<void> = new BABYLON.Observable();

            private rotateSounds: Array<BABYLON.Sound> = [];

            private materialToSidePlanes: Map<BABYLON.Material, Array<BABYLON.AbstractMesh>> = new Map();
            private sidePlaneToCubeMesh: Map<BABYLON.AbstractMesh, BABYLON.AbstractMesh> = new Map();

            private transformNode: BABYLON.TransformNode;
            private enabled: boolean = false;
            private shuffling: boolean = false;

            private startTime: Date = null;
            private timeUpdateHandle: any;

            private animatingCubes: Set<BABYLON.Mesh> = new Set();
            private cubes: Array<BABYLON.Mesh> = [];
            private moves: number = 0;
        }
        const rubiksCube = new RubiksCube();

        const gameOverText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('', 'You solved it!');
        gameOverText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        gameOverText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        gameOverText.color = 'white';
        gameOverText.fontSizeInPixels = 130;
        gameOverText.isVisible = false;
        gameOverText.shadowOffsetX = 5;
        gameOverText.shadowOffsetY = 5;
        gui.addControl(gameOverText);
        rubiksCube.onGameEnd.add(() => gameOverText.isVisible = true);

        const shuffleButton = BABYLON.GUI.Button.CreateSimpleButton("shuffleButton", "Shuffle/Reset");
        shuffleButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        shuffleButton.width = '400px';
        shuffleButton.height = '100px';
        shuffleButton.background = 'grey';
        shuffleButton.fontSizeInPixels = 40;
        shuffleButton.color = 'white';
        shuffleButton.onPointerClickObservable.add(() => {
            gameOverText.isVisible = false;
            shuffleButton.isVisible = false;
            rubiksCube.shuffle(() => shuffleButton.isVisible = true);
        });
        gui.addControl(shuffleButton);

        const statsPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
        statsPanel.background = 'rgba(0, 0, 0, 0.5)';
        statsPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        statsPanel.width = '300px';
        statsPanel.height = '800px';
        statsPanel.left = '-20px';
        gui.addControl(statsPanel);

        const createStatTextBlock: (string?) => BABYLON.GUI.TextBlock = (name?: string) => {
            const textBlock: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock(name === undefined ? '' : name);
            textBlock.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            textBlock.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
            textBlock.resizeToFit = true;
            textBlock.top = '100px';
            textBlock.color = 'white';
            textBlock.fontSizeInPixels = 50;
            statsPanel.addControl(textBlock);
            textBlock.paddingLeft = '20px';
            return textBlock;
        };

        const movesLabelText: BABYLON.GUI.TextBlock = createStatTextBlock();
        movesLabelText.top = '100px';
        movesLabelText.text = 'MOVES:';
        const movesLabelValue: BABYLON.GUI.TextBlock = createStatTextBlock('txtMovesValue');
        movesLabelValue.top = '150px';
        movesLabelValue.text = '';
        rubiksCube.onMoveMade.add((moveCount) => movesLabelValue.text = moveCount + '');

        const timeLabelText: BABYLON.GUI.TextBlock = createStatTextBlock();
        timeLabelText.top = '300px';
        timeLabelText.text = 'TIMER:';
        const timeValueText: BABYLON.GUI.TextBlock = createStatTextBlock('txtTimerValue');
        timeValueText.top = '350px';
        timeValueText.text = '';
        rubiksCube.onClockTick.add((timeStr) => timeValueText.text = timeStr);

        const infoText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('', '@blindinghues');
        infoText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        infoText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoText.resizeToFit = true;
        infoText.color = 'white';
        infoText.fontSizeInPixels = 20;
        gui.addControl(infoText);

        rubiksCube.initEvents();


        return scene;
    }
}