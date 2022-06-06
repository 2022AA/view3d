var decoderModule;

function Viewer() {

    var modelUrl = decodeURIComponent(getParameterByName('modelUrl'));
    var basePath = decodeURIComponent(getParameterByName('basePath'));

    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    var app = new pc.Application(canvas, {
        mouse: new pc.Mouse(document.body),
        keyboard: new pc.Keyboard(window),
        touch: new pc.TouchDevice(window),
    });
    app.start();

    // Fill the available space at full resolution
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    app.scene.gammaCorrection = pc.GAMMA_SRGB;
    app.scene.toneMapping = pc.TONEMAP_ACES;

    // Ensure canvas is resized when window changes size
    window.addEventListener('resize', function() {
        app.resizeCanvas();
    });

    // Create camera entity
    var camera = new pc.Entity('camera');
    camera.setPosition(0, 0, 10);
    camera.addComponent('script');
    camera.addComponent('camera', {
        nearClip: 1,
        farClip: 100,
        fov: 55,
    });
    app.root.addChild(camera);

    // Make the camera interactive
    app.assets.loadFromUrl('./src/orbit-camera.js', 'script', function (err, asset) {
        camera.script.create('orbitCamera');
        camera.script.create('keyboardInput');
        camera.script.create('mouseInput');
        camera.script.create('touchInput');


        if (this.cameraPosition) {
            camera.script.orbitCamera.distance = this.cameraPosition.length();
        } else if (this.gltf) {
            camera.script.orbitCamera.focusEntity = this.gltf;
        }
    }.bind(this));

    // Create directional light entity
    var light = new pc.Entity('light');
    light.addComponent('light');
    light.setEulerAngles(45, 0, 45);
    app.root.addChild(light);

    // Set a prefiltered cubemap as the skybox
    var cubemapAsset = new pc.Asset('helipad', 'cubemap', {
        url: "./assets/cubemap/6079289/Helipad.dds"
    }, {
        "textures": [
            "./assets/cubemap/6079292/Helipad_posx.png",
            "./assets/cubemap/6079290/Helipad_negx.png",
            "./assets/cubemap/6079293/Helipad_posy.png",
            "./assets/cubemap/6079298/Helipad_negy.png",
            "./assets/cubemap/6079294/Helipad_posz.png",
            "./assets/cubemap/6079300/Helipad_negz.png"
        ],
        "magFilter": 1,
        "minFilter": 5,
        "anisotropy": 1,
        "name": "Helipad",
        "rgbm": true,
        "prefiltered": "Helipad.dds"
    });
    app.assets.add(cubemapAsset);
    app.assets.load(cubemapAsset);

    cubemapAsset.ready(function () {
        app.scene.skyboxMip = 2;
        app.scene.setSkybox(cubemapAsset.resources);
    });


    var Rotate = pc.createScript('rotate');
    Rotate.prototype.update = function (deltaTime) {
        this.entity.rotate(0, deltaTime * 20, 0);
    };

    // Add model
    var gltfRoot = new pc.Entity();
    // app.assets.loadFromUrl('assets/sci-fi/scene.gltf', 'json', function (err, asset) {
        app.assets.loadFromUrl(modelUrl, 'json', function (err, asset) {
        var json = asset.resource;
        var gltf = JSON.parse(json);
        loadGltf(gltf, app.graphicsDevice, function (err, res) {
            // add the loaded scene to the hierarchy
            gltfRoot.addComponent('model');
            gltfRoot.model.model = res.model;
        }, {
            // basePath: 'assets/sci-fi/'
            basePath: basePath,
        });
    }.bind(this));
    gltfRoot.addComponent('script');
    gltfRoot.script.create('rotate');
    gltfRoot.setPosition(0, -1, 0);
    app.root.addChild(gltfRoot);

    this.app = app;
    this.camera = camera;
    this.playing = true; // for play/pause button
    this.overlay = init_overlay();
    this.setupAnimControls();
    this.timeline = new Timeline();

    this.shaderChunks = new ShaderChunks();

    // move touch
    // var Touch = pc.createScript("touch");

    // Touch.attributes.add("redMaterial", { type: "asset", assetType: "material", title: "Red Material" });
    // Touch.attributes.add("greenMaterial", { type: "asset", assetType: "material", title: "Green Material" });

    // Touch.prototype.initialize = function() {
    //     this.pos = new pc.Vec3();
    //     this.cameraEntity = this.app.root.findByName("camera");

    //     // Only register touch events if the device supports touch
    //     var touch = this.app.touch;
    //     if (touch) {
    //         touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
    //         touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    //         touch.on(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
    //         touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchCancel, this);
    //     }

    //     this.on('destroy', function() {
    //         touch.off(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
    //         touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    //         touch.off(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
    //         touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchCancel, this);
    //     }, this);
    // };

    // Touch.prototype.updateFromScreen = function (screenPos) {
    //     // Use the camera component's screenToWorld function to convert the
    //     // position of the mouse into a position in 3D space
    //     var depth = 5;

    //     this.cameraEntity.camera.screenToWorld(screenPos.x, screenPos.y, depth, this.pos);

    //     // Finally update the cube's world-space position
    //     this.entity.setPosition(this.pos);
    // };

    // Touch.prototype.changeMaterial = function (materialAsset) {
    //     // Find all the render components and change the material on all
    //     // mesh instances
    //     var renders = this.entity.findComponents('render');
    //     for (var i = 0; i < renders.length; ++i) {
    //         var meshInstances = renders[i].meshInstances;
    //         for (var j = 0; j < meshInstances.length; j++) {
    //             meshInstances[j].material = materialAsset.resource;
    //         }
    //     }
    // };

    // Touch.prototype.onTouchStart = function (event) {
    //     // For the demo, we only work with the first registered touch
    //     if (event.touches.length === 1) {
    //         this.changeMaterial(this.redMaterial);
    //         this.updateFromScreen(event.touches[0]);
    //     }

    //     // Needs to be called to remove 300ms delay and stop
    //     // browsers consuming the event for something else
    //     // such as zooming in
    //     event.event.preventDefault();
    // };

    // Touch.prototype.onTouchMove = function (event) {
    //     // Use only the first touch screen x y position to move the entity
    //     this.updateFromScreen(event.touches[0]);
    //     event.event.preventDefault();
    // };

    // Touch.prototype.onTouchEnd = function (event) {
    //     // Change the material only if the last touch has ended
    //     if (event.touches.length === 0) {
    //         this.changeMaterial(this.greenMaterial);
    //     }

    //     event.event.preventDefault();
    // };

    // Touch.prototype.onTouchCancel = function (event) {
    //     // Change the material only if the last touch has ended
    //     if (event.touches.length === 0) {
    //         this.changeMaterial(this.greenMaterial);
    //     }

    //     event.event.preventDefault();
    // };
    // gltfRoot.script.create('touch');

    // Press 'D' to delete the currently loaded model
    app.on('update', function () {
        if (viewer.shaderChunks.enabled == false && this.app.keyboard.wasPressed(pc.KEY_D)) {
            this.destroyScene();
        }
        if (this.gltf && this.gltf.animComponent) {
            // mirror the playback time of the playing clip into the html range slider
            var curTime = this.gltf.animComponent.getCurrentClip().session.curTime;
            this.anim_slider.value = curTime;
        }
        this.timeline.render();
    }, this);
}

Viewer.prototype = {
    destroyScene: function () {
        if (this.textures) {
            this.textures.forEach(function (texture) {
                texture.destroy();
            });
        }

        // First destroy the glTF entity...
        if (this.gltf) {
            if (this.gltf.animComponent) {
                this.gltf.animComponent.stopClip();
            }
            if (this.camera.script.orbitCamera.focusEntity) {
                this.camera.script.orbitCamera.focusEntity = null;
            }
            this.gltf.destroy();
        }

        // ...then destroy the asset. If not done in this order,
        // the entity will be retained by the JS engine.
        if (this.asset) {
            this.app.assets.remove(this.asset);
            this.asset.unload();
        }

        // Blow away all properties holding the loaded scene
        delete this.asset;
        delete this.textures;
        delete this.animationClips;
        delete this.gltf;
    },

    initializeScene: function (err, res) {
        var i;

        var model = res.model;
        var textures = res.textures;
        var animationClips = res.animations;

        if (!this.onlyLoadAnimations) {
            // Blow away whatever is currently loaded
            this.destroyScene();

            // Wrap the model as an asset and add to the asset registry
            // assetUrl = "assets/studded_tyre/scene.gltf"
            var asset = new pc.Asset('gltf', 'model', {
                url: 'assets/studded_tyre/scene.gltf'
            });
            asset.resource = model;
            asset.loaded = true;
            this.app.assets.add(asset);

            // Store the loaded resources
            this.asset = asset;
            this.textures = textures;

            // Add the loaded scene to the hierarchy
            this.gltf = new pc.Entity('gltf');
            this.gltf.addComponent('model', {
                asset: asset
            });
            this.app.root.addChild(this.gltf);

            // Now that the model is created, after translateAnimation, we have to hook here
            if (animationClips) {
                for (i = 0; i < animationClips.length; i++) {
                    for(var c = 0; c < animationClips[i].animCurves.length; c++) {
                        var curve = animationClips[i].animCurves[c];
                        if (curve.animTargets[0].targetNode === "model")
                            curve.animTargets[0].targetNode = this.gltf;
                    }
                }
            }
        }

        // Load any animations
        if (animationClips && animationClips.length > 0) {
            this.animationClips = animationClips;

            // If we don't already have an animation component, create one.
            // Note that this isn't really a 'true' component like those
            // found in the engine...
            if (!this.gltf.animComponent) {
                this.gltf.animComponent = new AnimationComponent();
            }

            // Add all animations to the model's animation component
            for (i = 0; i < animationClips.length; i++) {
                animationClips[i].transferToRoot(this.gltf);
                this.gltf.animComponent.addClip(animationClips[i]);
            }
            this.gltf.animComponent.curClip = animationClips[0].name;
            this.pauseAnimationClips();
            this.playCurrentAnimationClip();

            select_remove_options(this.anim_select);
            for (i = 0; i < animationClips.length; i++) {
                select_add_option(this.anim_select, animationClips[i].name);
            }
            this.anim_info.innerHTML = animationClips.length + " animation clips loaded";
        }

        // Focus the camera on the newly loaded scene
        if (this.camera.script.orbitCamera) {
            if (this.cameraPosition) {
                this.camera.script.orbitCamera.distance = this.cameraPosition.length();
            } else {
                this.camera.script.orbitCamera.frameOnStart = true;
                this.camera.script.orbitCamera.focusEntity = this.gltf;
            }
        }
    },

    loadGlb: function (arrayBuffer) {
        loadGlb(arrayBuffer, this.app.graphicsDevice, this.initializeScene.bind(this));
    },

    loadGltf: function (gltf, basePath, processUri) {
        loadGltf(gltf, this.app.graphicsDevice, this.initializeScene.bind(this), {
            decoderModule: decoderModule,
            basePath: basePath,
            processUri: processUri
        });
    },

    pauseAnimationClips: function() {
        if (this.gltf && this.gltf.animComponent) {
            this.gltf.animComponent.pauseAll();
            this.playing = false;
            this.anim_pause.value = ">";
        }
    },

    resumeCurrentAnimationClip: function() {
        if (this.gltf && this.gltf.animComponent) {
            var clip = this.gltf.animComponent.getCurrentClip();
            clip.resume();
            this.anim_slider.max = clip.duration;
            this.playing = true;
            this.anim_pause.value = "||";
            this.clip = clip; // quick access for f12 devtools
            this.timeline.resize();
        }
    },
    playCurrentAnimationClip: function() {
        if (this.gltf && this.gltf.animComponent) {
            //this.gltf.animComponent.getCurrentClip().resume(); // resume doesn't work yet
            var clip = this.gltf.animComponent.getCurrentClip();
            clip.play(); // just play it again, until resume() works
            this.anim_slider.max = clip.duration;
            this.playing = true;
            this.anim_pause.value = "||";
            this.clip = clip; // quick access for f12 devtools
            this.timeline.resize();
        }
    },

    togglePlayPauseAnimation: function() {
        if (this.playing) {
            this.pauseAnimationClips();
        } else {
            this.resumeCurrentAnimationClip();
        }
    },

    pauseAnimationsAndSeekToTime: function(curTime) {
        if (this.gltf && this.gltf.animComponent) {
            // once we seek into the animation, stop the default playing
            this.pauseAnimationClips();
            // now set the seeked time for the last played clip
            var clip = this.gltf.animComponent.getCurrentClip();
            var session = clip.session;
            var self = session;
            session.curTime = curTime;
            self.showAt(self.curTime, self.fadeDir, self.fadeBegTime, self.fadeEndTime, self.fadeTime);
            self.invokeByTime(self.curTime);
        } else {
            this.anim_info.innerHTML = "please load a gltf with animation clips";
        }
    },

    switchToClipByName: function(clipName) {
        if (this.gltf && this.gltf.animComponent) {
            var clip = this.gltf.animComponent.animClipsMap[clipName];
            this.anim_info.innerHTML = clip.duration + "s " + clipName;
            this.gltf.animComponent.curClip = clipName;
            this.pauseAnimationClips();
            this.playCurrentAnimationClip();
        } else {
            this.anim_info.innerHTML = "please load a gltf with animation clips";
        }
    },

    setupAnimControls: function() {
        // this.anim_select = document.getElementById("anim_select");
        // this.anim_select.onchange = function(e) {
        //     var clipName = this.anim_select.value;
        //     this.switchToClipByName(clipName);
        // }.bind(this);

        this.anim_slider = document.getElementById("anim_slider");
        this.anim_slider.oninput = function(e) {
            var curTime = Number(this.anim_slider.value);
            this.pauseAnimationsAndSeekToTime(curTime);
        }.bind(this);

        this.anim_pause = document.getElementById("anim_pause");
        this.anim_pause.onclick = function(e) {
            this.togglePlayPauseAnimation();
        }.bind(this);

        this.anim_info = document.getElementById("anim_info");

        window.onresize = function () {
            this.timeline.resize();
            this.shaderChunks.resize();
        }.bind(this);
    },

    log: function(msg) {
        this.anim_info.innerHTML = msg;
    }
};

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function loadScript(src) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    return new Promise(function (resolve) {
        script.onload = resolve;
        head.appendChild(script);
    });
}

function main() {
    if (typeof WebAssembly !== 'object') {
        loadScript('./assets/draco/draco_decoder.js').then(function () {
            decoderModule = DracoDecoderModule();
        });
    } else {
        loadScript('./assets/draco/draco_wasm_wrapper.js').then(function () {
            fetch('./assets/draco/draco_decoder.wasm').then(function (response) {
                response.arrayBuffer().then(function (arrayBuffer) {
                    decoderModule = DracoDecoderModule({ wasmBinary: arrayBuffer });
                });
            });
        });
    }

    viewer = new Viewer();

    var assetUrl = getParameterByName('assetUrl');
    if (assetUrl) {
        if (assetUrl.endsWith('gltf')) {
            fetch(assetUrl)
                .then(function(response) {
                    response.json().then(function(gltf) {
                        var basePath = assetUrl.substring(0, assetUrl.lastIndexOf('/')) + "/";
                        console.log(basePath);
                        viewer.loadGltf(gltf, basePath);
                    });
                });
        } else if (assetUrl.endsWith('glb')) {
            fetch(assetUrl)
                .then(function(response) {
                    response.arrayBuffer().then(function(glb) {
                        viewer.loadGlb(glb);
                    });
                });
        }
    }

    var cameraPosition = getParameterByName('cameraPosition');
    if (cameraPosition) {
        var pos = cameraPosition.split(',').map(Number);
        if (pos.length === 3) {
            viewer.cameraPosition = new pc.Vec3(pos);
        }
    }

    // Handle dropped GLB/GLTF files
    document.addEventListener('dragover', function (event) {
        event.preventDefault();
    }, false);

    document.addEventListener('drop', function (event) {
        event.preventDefault();

        var dropzone = document.getElementById('dropzone');
        dropzone.style.display = 'none';

        viewer.onlyLoadAnimations = event.ctrlKey;

        var loadFile = function (file, availableFiles) {
            var processUri = function (uri, success) {
                for (filename in availableFiles) {
                    if (filename.endsWith(uri)) {
                        if (uri.endsWith('.bin')) {
                            var fr = new FileReader();
                            fr.onload = function() {
                                success(fr.result);
                            };
                            fr.readAsArrayBuffer(availableFiles[filename]);
                        } else { // ...it's an image
                            var url = URL.createObjectURL(availableFiles[filename]);
                            success(url);
                        }
                    }
                }
            };

            var fr = new FileReader();
            fr.onload = function() {
                var arrayBuffer = fr.result;
                var extension = file.name.split('.').pop();

                if (extension === 'glb') {
                    viewer.loadGlb(arrayBuffer);
                } else if (extension === 'gltf') {
                    var decoder = new TextDecoder('utf-8');
                    var json = decoder.decode(arrayBuffer);
                    var gltf = JSON.parse(json);
                    viewer.loadGltf(gltf, undefined, processUri);
                }
            };
            fr.readAsArrayBuffer(file);
        };

        var getFiles = function (success) {
            var foldersRequested = 0;
            var foldersCompleted = 0;
            var filesRequested = 0;
            var filesCompleted = 0;

            var files = {};

            var loadEntries = function (entries) {
                var entry = entries.pop();
                if (entry.isFile) {
                    filesRequested++;
                    entry.file(function (file) {
                        files[entry.fullPath] = file;
                        filesCompleted++;
                        if ((foldersRequested === foldersCompleted) && (filesRequested === filesCompleted)) {
                            success(files);
                        }
                    });
                    if (entries.length > 0) {
                        loadEntries(entries);
                    }
                } else if (entry.isDirectory) {
                    foldersRequested++;
                    var reader = entry.createReader();
                    reader.readEntries(function (entries) {
                        loadEntries(entries);
                        foldersCompleted++;
                        if ((foldersRequested === foldersCompleted) && (filesRequested === filesCompleted)) {
                            success(files);
                        }
                    });
                }
            };

            var i;
            var items = event.dataTransfer.items;
            if (items) {
                var entries = [];
                for (i = 0; i < items.length; i++) {
                    entries[i] = items[i].webkitGetAsEntry();
                }
                loadEntries(entries);
            }
        };

        getFiles(function (files) {
            for (var filename in files) {
                if (filename.endsWith('.gltf') || filename.endsWith('.glb')) {
                    loadFile(files[filename], files);
                }
            };
        });

    }, false);
}
