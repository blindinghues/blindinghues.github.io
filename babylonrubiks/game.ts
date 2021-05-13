class Playground {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        const scene = new BABYLON.Scene(engine);
        scene.ambientColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        scene.clearColor = new BABYLON.Color4(0.3, 0.3, 0.3, 1.0);

        const camera = new BABYLON.ArcRotateCamera("Camera", 0, Math.PI / 2, 10, new BABYLON.Vector3(0, 0, 0), scene);
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 30;
        camera.panningSensibility = 0;
        camera.wheelPrecision = 500;
        camera.attachControl(canvas, true);

        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        const radialPlaneBackground: BABYLON.Mesh = BABYLON.MeshBuilder.CreatePlane('', { size: 50 }, scene);
        radialPlaneBackground.position.z = 20;
        radialPlaneBackground.parent = camera;
        radialPlaneBackground.isPickable = false;
        const radialPlaneMaterial: BABYLON.StandardMaterial = new BABYLON.StandardMaterial('', scene);
        radialPlaneMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        radialPlaneMaterial.disableLighting = true;
        radialPlaneMaterial.diffuseTexture = new BABYLON.Texture('textures/radialblue.png', scene);
        radialPlaneBackground.material = radialPlaneMaterial;


        // Create GUI
        const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('');
        gui.idealHeight = 1080;

        function getRandomElementFromArray<T>(arr: Array<T>) : T {
            console.assert(arr.length != 0);
            return arr[Math.floor(arr.length * Math.random())];
        }

        class RotationAxis {
            public constructor(component: string) { this.component = component; }
            public getComponent(): string { return this.component; }
            public static Pitch = new RotationAxis('x');
            public static Yaw = new RotationAxis('y');
            public static Roll = new RotationAxis('z');
            private component: string;
        }

        interface RubiksCreationOptions {
            width: number;
            shuffleCount: number;
        }
        class RubiksCube {
            public constructor(creationOptions: RubiksCreationOptions) {
                this.width = creationOptions.width;
                this.shuffleCount = creationOptions.shuffleCount;
                this.transformNode = new BABYLON.TransformNode('', scene);
                this.createCubes();
                this.setupDragCallbacks();
                this.enabled = false;
            }

            public dispose() {
                this.transformNode.dispose();
                scene.onPointerObservable.remove(this.pointerObservable);
                if (this.timeUpdateHandle) clearInterval(this.timeUpdateHandle);
                if (this.randomRotationUpdateHandle) clearInterval(this.randomRotationUpdateHandle);
            }

            public initEvents() {
                this.onCreate.notifyObservers({
                    width: this.width,
                    shuffleCount: this.shuffleCount
                });
                this.setMoves(this.moves);
                this.setTime(0);
            }

            public static loadResources(): Promise<void> {
                return new Promise((resolve, reject) => {
                    let remainingCount: number = 15;
                    let onLoad = () => {
                        if (--remainingCount == 0)
                            resolve();
                    }
                    RubiksCube.WIN_SOUND = new BABYLON.Sound('', `sounds/ditties/gamewin.mp3`, scene, onLoad, {
                        loop: false, autoplay: false
                    });
                    for (let i = 1; i <= 14; i++) {
                        RubiksCube.ROTATE_SOUNDS.push(
                            new BABYLON.Sound('', `sounds/rotations/${i}.ogg`, scene, onLoad, {
                                loop: false, autoplay: false
                            })
                        )
                    }
                });
            }

            private createCubes() {
                // create template cube
                const blackBoxMaterial: BABYLON.StandardMaterial = new BABYLON.StandardMaterial('', scene);
                blackBoxMaterial.ambientColor = BABYLON.Color3.Black();
                blackBoxMaterial.disableLighting = true;
                const templateCube: BABYLON.Mesh = BABYLON.MeshBuilder.CreateBox('', {size: 1}, scene);
                templateCube.material = blackBoxMaterial;
                templateCube.isVisible = false;
                templateCube.parent = this.transformNode;

                // create cube grid
                for (let x = 0; x < this.width; x++) {
                    for (let z = 0; z < this.width; z++) {
                        for (let y = 0; y < this.width; y++) {
                            // create cube at x,y,z
                            const cube: BABYLON.AbstractMesh = templateCube.createInstance('');
                            cube.isVisible = true;
                            cube.position = new BABYLON.Vector3(x, y, z);
                            this.cubes.push(cube);
                            cube.parent = this.transformNode;
                        }
                    }
                }
                
                // calculate center point
                this.centerPoint = this.cubes.reduce((total: BABYLON.Vector3, cube: BABYLON.AbstractMesh) => 
                    total.addInPlace(cube.position), BABYLON.Vector3.Zero()).scale(1/this.cubes.length);

                // create plane faces
                [ 
                    {   color: new BABYLON.Color3(255 / 255, 255 / 255, 255 / 255),
                        rotation: new BABYLON.Vector3(Math.PI / 2, 0, 0), normal: new BABYLON.Vector3(0, 1, 0)
                    }, {color: new BABYLON.Color3(255 / 255, 213 / 255, 0 / 255),
                        rotation: new BABYLON.Vector3(-Math.PI / 2, 0, 0), normal: new BABYLON.Vector3(0, -1, 0)
                    }, {color: new BABYLON.Color3(0 / 255, 70 / 255, 173 / 255),
                        rotation: new BABYLON.Vector3(0, -Math.PI / 2, 0), normal: new BABYLON.Vector3(1, 0, 0)
                    }, {color: new BABYLON.Color3(0 / 255, 155 / 255, 72 / 255),
                        rotation: new BABYLON.Vector3(0, Math.PI / 2, 0), normal: new BABYLON.Vector3(-1, 0, 0)
                    }, {color: new BABYLON.Color3(255 / 255, 88 / 255, 0 / 255),
                        rotation: new BABYLON.Vector3(Math.PI, 0, 0), normal: new BABYLON.Vector3(0, 0, 1)
                    }, {color: new BABYLON.Color3(183 / 255, 18 / 255, 52 / 255),
                        rotation: new BABYLON.Vector3(0, 0, 0), normal: new BABYLON.Vector3(0, 0, -1)
                    }
                ].forEach(planeDetails => {
                    const material: BABYLON.StandardMaterial = new BABYLON.StandardMaterial('', scene);
                    material.ambientColor = planeDetails.color;
                    material.disableLighting = true;
                    this.materialToSidePlanes.set(material, []);
                    const templatePlane: BABYLON.Mesh = BABYLON.MeshBuilder.CreatePlane('', {size: 0.96}, scene);
                    templatePlane.material = material;
                    templatePlane.parent = this.transformNode;
                    templatePlane.isVisible = false;
                    this.cubes
                        .filter(cube => !this.cubes.some(ocube => ocube.position.equals(cube.position.add(planeDetails.normal))))
                        .forEach(cube => {
                            const planeMesh: BABYLON.AbstractMesh = templatePlane.createInstance('');
                            planeMesh.isVisible = true;
                            planeMesh.isPickable = true;
                            planeMesh.parent = cube;
                            planeMesh.position = planeDetails.normal.scale(0.5001).clone();
                            planeMesh.rotation = planeDetails.rotation.clone();
                            this.sidePlaneToCubeMesh.set(planeMesh, cube);
                            this.materialToSidePlanes.get(material).push(planeMesh);
                        });
                });

                camera.setTarget(this.centerPoint);
            }

            private setupDragCallbacks() {
                let firstPick: BABYLON.AbstractMesh = null;
                this.pointerObservable = scene.onPointerObservable.add(eventData => {
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

            public shuffle() {
                if (this.shuffleCount <= 0)
                    return;
                this.setMoves(0);
                if (this.timeUpdateHandle) {
                    clearInterval(this.timeUpdateHandle);
                    this.timeUpdateHandle = null;
                }
                this.enabled = false;
                this.shuffling = true;
                const axisOptions: Array<RotationAxis> = [RotationAxis.Yaw, RotationAxis.Pitch, RotationAxis.Roll];
                const ccwOptions: Array<boolean> = [true, false];
                const layerOptions: Array<number> = new Array(this.width).fill(null).map((x, idx) => idx);
                let movementCount: number = this.shuffleCount;
                this.randomRotationUpdateHandle = setInterval(() => {
                    rubiksCube.rotate(
                        getRandomElementFromArray(axisOptions),
                        getRandomElementFromArray(layerOptions),
                        getRandomElementFromArray(ccwOptions),
                        2
                    );
                    if (--movementCount == 0) {
                        clearInterval(this.randomRotationUpdateHandle);
                        this.randomRotationUpdateHandle = null;
                        this.enabled = true;
                        this.shuffling = false;
                        this.startTime = new Date();
                        this.timeUpdateHandle = setInterval(() => {
                            this.setTime((new Date()).getTime() - this.startTime.getTime());
                        }, 32);
                    }
                }, 50);
            }

            private relativeToMe(position: BABYLON.Vector3) {
                return BABYLON.Vector3.TransformCoordinates(position, this.transformNode.getWorldMatrix().clone().invert());
            }

            public getTransformNode(): BABYLON.TransformNode { return this.transformNode; }

            public rotate(axis: RotationAxis, layer: number, ccw: boolean, speedModifier? : number): boolean {
                console.assert(layer >= 0 && layer < this.width);
                speedModifier = speedModifier === undefined ? 1: speedModifier;

                // determine cubes to rotate
                const cubesToRotate: Array<BABYLON.AbstractMesh> = this.cubes
                .filter((cube) => !this.animatingCubes.has(cube))
                .filter((cube) => {
                    const relativeCubePos: BABYLON.Vector3 = cube.position;
                    switch(axis) {
                        case RotationAxis.Roll: return relativeCubePos.z == layer;
                        case RotationAxis.Yaw: return relativeCubePos.y == layer;
                        case RotationAxis.Pitch: return relativeCubePos.x == layer;
                    }
                });
                
                // if we can't rotate all the cubes in the layer, don't allow the rotation to occur
                if (cubesToRotate.length != Math.pow(this.width, 2))
                    return false;

                cubesToRotate.forEach(cube => this.animatingCubes.add(cube));

                // parent cubes to transform node and rotate it
                const rotationInRadians: number = Math.PI * 0.5 * (ccw? 1 : -1);
                const transformNode = new BABYLON.TransformNode('', scene);
                transformNode.position = new BABYLON.Vector3(
                    axis == RotationAxis.Pitch ? layer : 0,
                    axis == RotationAxis.Yaw ? layer : 0,
                    axis == RotationAxis.Roll ? layer : 0
                );
                transformNode.position.addInPlace(this.centerPoint);

                transformNode.parent = this.transformNode;
                cubesToRotate.forEach(cube => cube.setParent(transformNode));
                const animation = BABYLON.Animation.CreateAndStartAnimation('', transformNode, `rotation.${axis.getComponent()}`,
                    60, 15 / speedModifier, 0, rotationInRadians, 0);

                // play rotating sound effect
                getRandomElementFromArray(RubiksCube.ROTATE_SOUNDS).play();

                // when the animation is finished...
                animation.onAnimationEnd = () => {
                    // unparent cubes from transform node
                    cubesToRotate.forEach(cube => {
                        cube.setParent(this.transformNode);
                        // round positions & rotations to avoid accumulating FP errors
                        cube.position.set(
                            Math.round(cube.position.x),
                            Math.round(cube.position.y),
                            Math.round(cube.position.z)
                        );
                        cube.rotation.set(
                            Math.round(cube.rotation.x / (Math.PI / 2)) * (Math.PI / 2),
                            Math.round(cube.rotation.y / (Math.PI / 2)) * (Math.PI / 2),
                            Math.round(cube.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
                        );
                    });
                    transformNode.dispose();
                    cubesToRotate.forEach(cube => this.animatingCubes.delete(cube));
                    // check to see if the rubiks cube is now solved
                    if (!this.shuffling && this.isSolved()) {
                        this.endGame();
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

            private endGame() {
                this.enabled = false;
                clearInterval(this.timeUpdateHandle);
                this.timeUpdateHandle = null;
                this.onGameEnd.notifyObservers();
                RubiksCube.WIN_SOUND.play();
            }

            private setMoves(moves: number) {
                if (this.shuffling)
                    return;
                this.moves = moves;
                this.onMoveMade.notifyObservers(this.moves);
            }
            private setTime(timeInMS: number) {
                const timeString: string = new Date(timeInMS).toISOString().substr(11, 8);
                this.onClockTick.notifyObservers(timeString);
            }

            public onMoveMade: BABYLON.Observable<number> = new BABYLON.Observable();
            public onClockTick: BABYLON.Observable<string> = new BABYLON.Observable();
            public onGameEnd: BABYLON.Observable<void> = new BABYLON.Observable();
            public onCreate: BABYLON.Observable<RubiksCreationOptions> = new BABYLON.Observable();

            private width: number;
            private shuffleCount: number;
            private centerPoint: BABYLON.Vector3;

            private static ROTATE_SOUNDS: Array<BABYLON.Sound> = [];
            private static WIN_SOUND: BABYLON.Sound;

            private materialToSidePlanes: Map<BABYLON.Material, Array<BABYLON.AbstractMesh>> = new Map();
            private sidePlaneToCubeMesh: Map<BABYLON.AbstractMesh, BABYLON.AbstractMesh> = new Map();

            private transformNode: BABYLON.TransformNode;
            private enabled: boolean = false;
            private shuffling: boolean = false;

            private startTime: Date = null;

            private timeUpdateHandle: any;
            private randomRotationUpdateHandle: any;

            private animatingCubes: Set<BABYLON.AbstractMesh> = new Set();
            private cubes: Array<BABYLON.AbstractMesh> = [];
            private moves: number = 0;

            private pointerObservable: BABYLON.Observer<BABYLON.PointerInfo>;
        }

        // load rubiks resources
        RubiksCube.loadResources().then(() => {
            gameContainer.isVisible = true;
        });

        // create rubiks cube
        let rubiksCube = new RubiksCube({width: 3, shuffleCount: 0});
        const onRubiksCreate: BABYLON.Observable<RubiksCube> = new BABYLON.Observable();

        /**
         * GUI
         */

        // Game container
        const gameContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
        gameContainer.isVisible = false;
        gui.addControl(gameContainer);
            const createStatTextBlock: (string?) => BABYLON.GUI.TextBlock = (name?: string) => {
                const textBlock: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock(name === undefined ? '' : name);
                textBlock.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                textBlock.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                textBlock.resizeToFit = true;
                textBlock.top = '100px';
                textBlock.color = 'white';
                textBlock.fontSizeInPixels = 50;
                textBlock.paddingLeft = '20px';
                return textBlock;
            };
            const gameOverText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('', 'You solved it!');
            gameOverText.color = 'white';
            gameOverText.fontSizeInPixels = 130;
            gameOverText.isVisible = false;
            gameOverText.shadowOffsetX = 5;
            gameOverText.shadowOffsetY = 5;
            gameOverText.resizeToFit = true;
            gameOverText.zIndex = 1;
            gui.addControl(gameOverText);
            onRubiksCreate.add((rubiksCube) => rubiksCube.onGameEnd.add(() => gameOverText.isVisible = true));
            onRubiksCreate.add((rubiksCube) => rubiksCube.onCreate.add(() => gameOverText.isVisible = false));
            const resetButton = BABYLON.GUI.Button.CreateSimpleButton("shuffleButton", "NEW GAME");
            resetButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            resetButton.width = '350px';
            resetButton.height = '100px';
            resetButton.background = 'grey';
            resetButton.fontSizeInPixels = 40;
            resetButton.color = 'white';
            resetButton.onPointerClickObservable.add(() => {
                gameContainer.isVisible = false;
                optionsContainer.isVisible = true;
            });
            gameContainer.addControl(resetButton);
            const bottomText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('');
            bottomText.resizeToFit = true;
            bottomText.text = 'Rotate segments by dragging across the tiles';
            bottomText.top = "100px";
            bottomText.fontSize = '40px';
            bottomText.color = 'white';
            bottomText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
            gameContainer.addControl(bottomText);
            const statsPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
            statsPanel.background = 'rgba(0, 0, 0, 0.8)';
            statsPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            statsPanel.width = '300px';
            statsPanel.height = '800px';
            statsPanel.left = '-20px';
            gameContainer.addControl(statsPanel);
                const movesLabelText: BABYLON.GUI.TextBlock = createStatTextBlock();
                movesLabelText.top = '100px';
                movesLabelText.text = 'MOVES:';
                statsPanel.addControl(movesLabelText);
                const movesLabelValue: BABYLON.GUI.TextBlock = createStatTextBlock('txtMovesValue');
                movesLabelValue.top = '150px';
                movesLabelValue.text = '';
                onRubiksCreate.add((rubiksCube) => rubiksCube.onMoveMade.add((moveCount) => movesLabelValue.text = moveCount + ''));
                statsPanel.addControl(movesLabelValue);
                const timeLabelText: BABYLON.GUI.TextBlock = createStatTextBlock();
                timeLabelText.top = '300px';
                timeLabelText.text = 'TIMER:';
                statsPanel.addControl(timeLabelText);
                const timeValueText: BABYLON.GUI.TextBlock = createStatTextBlock('txtTimerValue');
                timeValueText.top = '350px';
                timeValueText.text = '';
                statsPanel.addControl(timeValueText);
                onRubiksCreate.add((rubiksCube) => rubiksCube.onClockTick.add((timeStr) => timeValueText.text = timeStr));
                const cubeWidthLabelText: BABYLON.GUI.TextBlock = createStatTextBlock();
                cubeWidthLabelText.top = '500px';
                cubeWidthLabelText.text = 'WIDTH:';
                statsPanel.addControl(cubeWidthLabelText);
                const cubeWidthValueText: BABYLON.GUI.TextBlock = createStatTextBlock();
                cubeWidthValueText.top = '550px';
                cubeWidthValueText.text = ':';
                statsPanel.addControl(cubeWidthValueText);
                onRubiksCreate.add((rubiksCube) => 
                    rubiksCube.onCreate.add(creationOptions => cubeWidthValueText.text = creationOptions.width + "")
                );

        // Options container
        const optionsContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
        {
            optionsContainer.isPointerBlocker = true;
            optionsContainer.isVisible = false;
            optionsContainer.zIndex = 999;
            gui.addControl(optionsContainer);
                const optionsPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                optionsPanel.background = 'rgba(0, 0, 0, 0.8)';
                optionsPanel.width = '500px';
                optionsPanel.height = '500px';
                optionsContainer.addControl(optionsPanel);
                    const topText = createStatTextBlock('');
                    topText.text = 'NEW GAME';
                    topText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                    topText.top = '30px';
                    optionsPanel.addControl(topText);
                    const sliderWidthValueText = createStatTextBlock('');
                    sliderWidthValueText.fontSize = '30px';
                    sliderWidthValueText.top = '160px';
                    optionsPanel.addControl(sliderWidthValueText);
                    const cubeWidthSlider = new BABYLON.GUI.Slider();
                    cubeWidthSlider.step = 1;
                    cubeWidthSlider.minimum = 2;
                    cubeWidthSlider.maximum = 7;
                    cubeWidthSlider.value = 7;
                    cubeWidthSlider.height = "20px";
                    cubeWidthSlider.width = "100%";
                    cubeWidthSlider.top = '200px';
                    cubeWidthSlider.color = 'white';
                    cubeWidthSlider.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                    cubeWidthSlider.onValueChangedObservable.add(() => sliderWidthValueText.text = `CUBE WIDTH: ${cubeWidthSlider.value}`);
                    onRubiksCreate.add(rubiksCube => 
                        rubiksCube.onCreate.add((options) => cubeWidthSlider.value = options.width)
                    );
                    optionsPanel.addControl(cubeWidthSlider);

                    const sliderShufflesValueText = createStatTextBlock('');
                    sliderShufflesValueText.fontSize = '30px';
                    sliderShufflesValueText.top = '260px';
                    optionsPanel.addControl(sliderShufflesValueText);
                    const cubeShufflesSlider = new BABYLON.GUI.Slider();
                    cubeShufflesSlider.step = 1;
                    cubeShufflesSlider.minimum = 1;
                    cubeShufflesSlider.maximum = 100;
                    cubeShufflesSlider.value = 7;
                    cubeShufflesSlider.height = "20px";
                    cubeShufflesSlider.width = "100%";
                    cubeShufflesSlider.top = '300px';
                    cubeShufflesSlider.color = 'white';
                    cubeShufflesSlider.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                    cubeShufflesSlider.onValueChangedObservable.add(() => sliderShufflesValueText.text = `SHUFFLE COUNT: ${cubeShufflesSlider.value}`);
                    onRubiksCreate.add(rubiksCube => 
                        rubiksCube.onCreate.add((options) => cubeShufflesSlider.value = (options.shuffleCount == 0 ? 50 : options.shuffleCount))
                    );
                    optionsPanel.addControl(cubeShufflesSlider);
                    
                    const backButton = BABYLON.GUI.Button.CreateSimpleButton('', "BACK");
                    backButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                    backButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                    backButton.left = '-130px';
                    backButton.top = '-18px';
                    backButton.width = '200px';
                    backButton.height = '80px';
                    backButton.background = 'grey';
                    backButton.fontSizeInPixels = 40;
                    backButton.color = 'white';
                    backButton.onPointerClickObservable.add(() => {
                        optionsContainer.isVisible = false;
                        gameContainer.isVisible = true;
                    });
                    optionsPanel.addControl(backButton);
                    const createButton = BABYLON.GUI.Button.CreateSimpleButton('', "CREATE");
                    createButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                    createButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                    createButton.left = '130px';
                    createButton.top = '-18px';
                    createButton.width = '200px';
                    createButton.height = '80px';
                    createButton.background = 'grey';
                    createButton.fontSizeInPixels = 40;
                    createButton.color = 'white';
                    createButton.onPointerClickObservable.add(() => {
                        optionsContainer.isVisible = false;
                        gameContainer.isVisible = true;
                        rubiksCube.dispose();
                        rubiksCube = new RubiksCube({
                            width: cubeWidthSlider.value,
                            shuffleCount: cubeShufflesSlider.value
                        });
                        onRubiksCreate.notifyObservers(rubiksCube);
                        rubiksCube.initEvents();
                        rubiksCube.shuffle();
                    });
                    optionsPanel.addControl(createButton);
        }

        // Social media icons
        class SocialMediaIcon {
            public constructor(imageUrl: string, linkUrl: string) {
                const iconContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                iconContainer.hoverCursor = "pointer";
                iconContainer.isPointerBlocker = true;
                gameContainer.addControl(iconContainer);
                this.container = iconContainer;
                const iconImage: BABYLON.GUI.Image = new BABYLON.GUI.Image('', imageUrl);
                iconImage.width = SocialMediaIcon.DEFAULT_SCALAR; iconImage.height = SocialMediaIcon.DEFAULT_SCALAR;
                iconContainer.onPointerEnterObservable.add(() => this.expand());
                iconContainer.onPointerOutObservable.add(() => this.shrink());
                iconContainer.onPointerClickObservable.add(() => {
                    this.shrink();
                    window.open(linkUrl,'_blank');
                });
                iconContainer.addControl(iconImage);
                this.iconImage = iconImage;
            }
            private expand() {
                this.iconImage.width = 1; this.iconImage.height = 1;
            }
            private shrink() {
                this.iconImage.width = SocialMediaIcon.DEFAULT_SCALAR; this.iconImage.height = SocialMediaIcon.DEFAULT_SCALAR;
            }
            public getContainer(): BABYLON.GUI.Container { return this.container; }

            private static DEFAULT_SCALAR: number = 0.9;
            private container: BABYLON.GUI.Container;
            private iconImage: BABYLON.GUI.Image;
        }

        const twitterIcon: SocialMediaIcon = new SocialMediaIcon('icons/twitter.svg', 'https://twitter.com/blindinghues');
        twitterIcon.getContainer().width = '75px'; twitterIcon.getContainer().height = '75px';
        twitterIcon.getContainer().left = '0px';
        twitterIcon.getContainer().verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        twitterIcon.getContainer().horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

        const githubIcon: SocialMediaIcon = new SocialMediaIcon('icons/github.svg', 'https://github.com/blindinghues');
        githubIcon.getContainer().width = '75px'; githubIcon.getContainer().height = '75px';
        githubIcon.getContainer().left = '80px';
        githubIcon.getContainer().verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        githubIcon.getContainer().horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;


        onRubiksCreate.notifyObservers(rubiksCube);
        rubiksCube.initEvents();
        return scene;
    }
}