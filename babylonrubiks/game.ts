/**
 * Sound effects obtained from https://www.zapsplat.com
 * Ambient music obtained from Axletree https://www.youtube.com/channel/UCU4a-7qXkoscDDFI3aYhi_g via FMA
 */

//
//

class Playground {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        const scene = new BABYLON.Scene(engine);
        scene.ambientColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        scene.clearColor = new BABYLON.Color4(0.3, 0.3, 0.3, 1.0);

        const camera = new BABYLON.ArcRotateCamera("Camera", 0, Math.PI / 2, 10, new BABYLON.Vector3(0, 0, 0), scene);
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 30;
        camera.upperAlphaLimit = null;
        camera.lowerAlphaLimit = null;
        camera.upperBetaLimit = null;
        camera.lowerBetaLimit = null;
        camera.panningSensibility = 0;
        camera.wheelPrecision = 500;
        camera.attachControl(canvas, true);

        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        const radialPlaneBackground: BABYLON.Mesh = BABYLON.MeshBuilder.CreatePlane('', { size: 100 }, scene);
        radialPlaneBackground.position.z = 40;
        radialPlaneBackground.parent = camera;
        radialPlaneBackground.isPickable = false;
        const radialPlaneMaterial: BABYLON.StandardMaterial = new BABYLON.StandardMaterial('', scene);
        radialPlaneMaterial.ambientColor = new BABYLON.Color3(1, 1, 1);
        radialPlaneMaterial.disableLighting = true;
        radialPlaneMaterial.diffuseTexture = new BABYLON.Texture('textures/radialblue.png', scene);
        radialPlaneBackground.material = radialPlaneMaterial;


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
                    let remainingCount: number = 16;
                    let onLoad = () => {
                        if (--remainingCount == 0)
                            resolve();
                        RubiksCube.BACKGROUND_SOUND.play();
                    }
                    RubiksCube.WIN_SOUND = new BABYLON.Sound('', `sounds/ditties/gamewin.mp3`, scene, onLoad, {
                        loop: false, autoplay: false
                    });
                    RubiksCube.BACKGROUND_SOUND = new BABYLON.Sound('', `sounds/music/Axletree - The Woods (Remastered).mp3`, scene, onLoad, {
                        loop: true, autoplay: false, volume: 0.1
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
                    const rotated: boolean =  rubiksCube.rotate(
                        getRandomElementFromArray(axisOptions),
                        getRandomElementFromArray(layerOptions),
                        getRandomElementFromArray(ccwOptions),
                        2
                    );
                    if (rotated && --movementCount == 0) {
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
                    const cubesRotations = planes.map(plane => this.sidePlaneToCubeMesh.get(plane).rotation);
                    valid = valid && cubesRotations.every(rotation => rotation.equals(cubesRotations[0]));
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
            private static BACKGROUND_SOUND: BABYLON.Sound;

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

        class GUI {
            public populateGUI() {
                this.loadingTextContainer.dispose();
                clearInterval(this.loadingTextUpdateHandle);
                this.loadingTextUpdateHandle = null;

                // Game container
                const gameContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                this.gui.addControl(gameContainer);
                    const gameOverText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('', 'You solved it!');
                    gameOverText.color = 'white';
                    gameOverText.fontSize = '130px';
                    gameOverText.isVisible = false;
                    gameOverText.shadowOffsetX = 5;
                    gameOverText.shadowOffsetY = 5;
                    gameOverText.resizeToFit = true;
                    gameOverText.zIndex = 1;
                    gameContainer.addControl(gameOverText);
                    onRubiksCreate.add((rubiksCube) => rubiksCube.onGameEnd.add(() => gameOverText.isVisible = true));
                    onRubiksCreate.add((rubiksCube) => rubiksCube.onCreate.add(() => gameOverText.isVisible = false));
                    const resetButton = BABYLON.GUI.Button.CreateSimpleButton("shuffleButton", "NEW GAME");
                    resetButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                    resetButton.width = '350px';
                    resetButton.height = '100px';
                    resetButton.background = 'grey';
                    resetButton.fontSize = '40px';
                    resetButton.color = 'white';
                    resetButton.onPointerClickObservable.add(() => {
                        GUI.BUTTON_CLICK_SOUND.play();
                        gameContainer.isVisible = false;
                        optionsContainer.isVisible = true;
                    });
                    gameContainer.addControl(resetButton);
                    const helpButton = BABYLON.GUI.Button.CreateSimpleButton("shuffleButton", "?");
                    helpButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                    helpButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
                    helpButton.width = '100px';
                    helpButton.height = '100px';
                    helpButton.background = 'grey';
                    helpButton.fontSize = '40px';
                    helpButton.color = 'white';
                    helpButton.onPointerClickObservable.add(() => {
                        GUI.BUTTON_CLICK_SOUND.play();
                        gameContainer.isVisible = false;
                        helpContainer.isVisible = true;
                    });
                    gameContainer.addControl(helpButton);
                    const bottomText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('');
                    bottomText.resizeToFit = true;
                    bottomText.text = 'Drag across tiles to move';
                    bottomText.top = "150px";
                    bottomText.fontSize = '40px';
                    bottomText.color = 'white';
                    bottomText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                    gameContainer.addControl(bottomText);
                    onRubiksCreate.add((rubiksCube) => rubiksCube.onMoveMade.add((count) => { if (count != 0) bottomText.isVisible = false; }));
                    const statsPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                    statsPanel.background = 'rgba(0, 0, 0, 0.8)';
                    statsPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                    statsPanel.width = '600px';
                    statsPanel.height = '90px';
                    statsPanel.top = '20px';
                    gameContainer.addControl(statsPanel);
                        const movesSection: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                        movesSection.width = '200px';
                        movesSection.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                        movesSection.paddingLeft = '20px'; 
                        statsPanel.addControl(movesSection);
                            const movesLabelText: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            movesLabelText.top = '0px';
                            movesLabelText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                            movesLabelText.text = 'MOVES:';
                            movesSection.addControl(movesLabelText);
                            const movesLabelValue: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            movesLabelValue.top = '0px';
                            movesLabelValue.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                            movesLabelValue.text = '';
                            onRubiksCreate.add((rubiksCube) => rubiksCube.onMoveMade.add((moveCount) => movesLabelValue.text = moveCount + ''));
                            movesSection.addControl(movesLabelValue);
                        const timeSection: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                        timeSection.width = '200px';
                        timeSection.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                        statsPanel.addControl(timeSection);
                            const timeLabelText: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            timeLabelText.top = '0px';
                            timeLabelText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                            timeLabelText.text = 'TIMER:';
                            timeSection.addControl(timeLabelText);
                            const timeValueText: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            timeValueText.top = '0px';
                            timeValueText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                            timeValueText.text = '';
                            timeSection.addControl(timeValueText);
                            onRubiksCreate.add((rubiksCube) => rubiksCube.onClockTick.add((timeStr) => timeValueText.text = timeStr));
                        const widthSection: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                        widthSection.paddingRight = '20px';
                        widthSection.width = '200px';
                        widthSection.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
                        statsPanel.addControl(widthSection);
                            const cubeWidthLabelText: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            cubeWidthLabelText.top = '0px';
                            cubeWidthLabelText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                            cubeWidthLabelText.text = 'WIDTH:';
                            widthSection.addControl(cubeWidthLabelText);
                            const cubeWidthValueText: BABYLON.GUI.TextBlock = GUI.createStandardTextBlock();
                            cubeWidthValueText.top = '0px';
                            cubeWidthValueText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                            cubeWidthValueText.text = ':';
                            widthSection.addControl(cubeWidthValueText);
                            onRubiksCreate.add((rubiksCube) => 
                                rubiksCube.onCreate.add(creationOptions => cubeWidthValueText.text = creationOptions.width + "")
                            );

                // Help container
                const helpContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                {
                    helpContainer.isPointerBlocker = true;
                    helpContainer.isVisible = false;
                    helpContainer.zIndex = 999;
                    this.gui.addControl(helpContainer);
                        const helpPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                        helpPanel.background = 'rgba(0, 0, 0, 0.8)';
                        helpPanel.width = '500px';
                        helpPanel.height = '500px';
                        helpContainer.addControl(helpPanel);
                            const topText = GUI.createStandardTextBlock();
                            topText.text = 'Controls';
                            topText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                            topText.top = '30px';
                            helpPanel.addControl(topText);
                            const detailsText = GUI.createStandardTextBlock();
                            detailsText.textWrapping = true;
                            detailsText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                            detailsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                            detailsText.fontSize = '25px';
                            detailsText.paddingLeft = '20px';
                            detailsText.text = `
Drag on the background to rotate the view

Drag across cube tiles to perform moves

Click 'new game' to reset


Have fun!
                            `;
                            detailsText.top = '80px';
                            helpPanel.addControl(detailsText);


                            const backButton = BABYLON.GUI.Button.CreateSimpleButton('', "BACK");
                            backButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                            backButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                            backButton.top = '-18px';
                            backButton.width = '200px';
                            backButton.height = '80px';
                            backButton.background = 'grey';
                            backButton.fontSize = '40px';
                            backButton.color = 'white';
                            backButton.onPointerClickObservable.add(() => {
                                GUI.BUTTON_BACK_SOUND.play();
                                helpContainer.isVisible = false;
                                gameContainer.isVisible = true;
                            });
                            helpPanel.addControl(backButton);
                }

                // Options container
                const optionsContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                {
                    optionsContainer.isPointerBlocker = true;
                    optionsContainer.isVisible = false;
                    optionsContainer.zIndex = 999;
                    this.gui.addControl(optionsContainer);
                        const optionsPanel: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                        optionsPanel.background = 'rgba(0, 0, 0, 0.8)';
                        optionsPanel.width = '500px';
                        optionsPanel.height = '500px';
                        optionsContainer.addControl(optionsPanel);
                            const topText = GUI.createStandardTextBlock();
                            topText.text = 'NEW GAME';
                            topText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                            topText.top = '30px';
                            optionsPanel.addControl(topText);
                            const sliderWidthValueText = GUI.createStandardTextBlock();
                            sliderWidthValueText.paddingLeft = '20px';
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

                            const sliderShufflesValueText = GUI.createStandardTextBlock();
                            sliderShufflesValueText.paddingLeft = '20px';
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
                            backButton.fontSize = '40px';
                            backButton.color = 'white';
                            backButton.onPointerClickObservable.add(() => {
                                GUI.BUTTON_BACK_SOUND.play();
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
                            createButton.fontSize = '40px';
                            createButton.color = 'white';
                            createButton.onPointerClickObservable.add(() => {
                                GUI.BUTTON_CONFIRM_SOUND.play();
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
                twitterIcon.getContainer().top = '-80px';
                twitterIcon.getContainer().verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                twitterIcon.getContainer().horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

                const githubIcon: SocialMediaIcon = new SocialMediaIcon('icons/github.svg', 'https://github.com/blindinghues');
                githubIcon.getContainer().width = '75px'; githubIcon.getContainer().height = '75px';
                githubIcon.getContainer().verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
                githubIcon.getContainer().horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            }
            public constructor() {
                const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('');
                gui.idealHeight = 1080;
                this.gui = gui;

                const loadingTextContainer: BABYLON.GUI.Container = new BABYLON.GUI.Container('');
                this.loadingTextContainer = loadingTextContainer;
                loadingTextContainer.width = '550px';
                gui.addControl(loadingTextContainer);
                const loadingText: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('');
                let dotCount = 1;
                this.loadingTextUpdateHandle = setInterval(() => {
                    dotCount = 1 + (dotCount % 3);
                    loadingText.text = 'LOADING' + new Array(dotCount).fill(null).map(x => '.').join('')
                }, 500);
                loadingText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                loadingText.text = "LOADING.";
                loadingText.resizeToFit = true;
                loadingText.color = 'white';
                loadingText.fontSize = '100px';
                loadingTextContainer.addControl(loadingText);
            }
            private static createStandardTextBlock(): BABYLON.GUI.TextBlock {
                const textBlock: BABYLON.GUI.TextBlock = new BABYLON.GUI.TextBlock('');
                textBlock.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                textBlock.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
                textBlock.resizeToFit = true;
                textBlock.color = 'white';
                textBlock.fontSize = '40px';
                return textBlock;
            }
            public static loadResources(): Promise<void> {
                return new Promise((resolve, reject) => {
                    let remainingCount: number = 2;
                    let onLoad = () => {
                        if (--remainingCount == 0)
                            resolve();
                        GUI.BACKGROUND_MUSIC.play();
                    }
                    GUI.BUTTON_CLICK_SOUND = new BABYLON.Sound('', `sounds/ui/buttonClick.mp3`, scene, onLoad, {
                        loop: false, autoplay: false
                    });
                    GUI.BUTTON_CONFIRM_SOUND = new BABYLON.Sound('', `sounds/ui/buttonConfirm.mp3`, scene, onLoad, {
                        loop: false, autoplay: false
                    });
                    GUI.BUTTON_BACK_SOUND = new BABYLON.Sound('', `sounds/ui/buttonBack.mp3`, scene, onLoad, {
                        loop: false, autoplay: false
                    });
                    GUI.BACKGROUND_MUSIC = new BABYLON.Sound('', `sounds/music/Axletree - The Woods (Remastered).mp3`, scene, onLoad, {
                        loop: true, autoplay: false, volume: 0.1
                    });
                });
            }
            private static BACKGROUND_MUSIC: BABYLON.Sound;
            private static BUTTON_CLICK_SOUND: BABYLON.Sound;
            private static BUTTON_BACK_SOUND: BABYLON.Sound;
            private static BUTTON_CONFIRM_SOUND: BABYLON.Sound;
            private gui: BABYLON.GUI;
            private loadingTextContainer: BABYLON.GUI.LoadingTextContainer;
            private loadingTextUpdateHandle: any;
        }

        let rubiksCube: RubiksCube = null;
        let gui: BABYLON.GUI = new GUI();
        const onRubiksCreate: BABYLON.Observable<RubiksCube> = new BABYLON.Observable();

        // load resources before creating GUI & cube
        Promise.all([
            RubiksCube.loadResources(),
            GUI.loadResources()
        ]).then(() => {
            gui.populateGUI();
            rubiksCube = new RubiksCube({width: 3, shuffleCount: 0});
            onRubiksCreate.notifyObservers(rubiksCube);
            rubiksCube.initEvents();
            rubiksCube.shuffle();
        });

        return scene;
    }
}