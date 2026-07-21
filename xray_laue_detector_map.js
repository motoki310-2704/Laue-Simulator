import * as THREE from 'three';

//JavaScript code for simulation of X-ray Laue backscattering
//Original: D. Kawana and T. Nakajima (ISSP-NSL), MIT License.
//Modified version: adds view switching (diffraction / stereographic projection),
//rotation tracking from origin, hover inspection, and misc. improvements.

const version = "1.3+m9";

const scaleX_default=1200;
const scaleY_default=400;


// dimensions of the canvas object (global variables)
let scaleX=1200;
let scaleY=400;

let X0=scaleX/2;
let Y0=scaleY/2;
let X0_ofst=0;
let Y0_ofst=0;


//parameters for the appearance of the simulation
let radius=5;       // radius of circles showing refletions in the simulation (adjustable by the spot-size slider).
let radius_tgt=8;     //// radius of a circle showing a target refletions in the simulation (tracks the spot-size slider).
let txt_ofst1=radius+10;   //offset along Y direction for indices shown near each reflection.
const ref_linewidth=1;

//colorSet variables
let fundamental_color="rgb(0, 0, 250)";
let DetMapBGColor="rgb(220, 220, 220)";
let gridcolor="rgb(250, 100, 0)";
//colorSet1
const fundamental_color1="rgb(0, 0, 250)";
const DetMapBGColor1="rgb(220, 220, 220)";
const gridcolor1="rgb(250, 100, 0)";
//colorSet2
const fundamental_color2="rgb(54, 250, 0)";
const DetMapBGColor2="rgb(16, 5, 168)";
const gridcolor2="rgb(250, 175, 0)";


//variables for calculating Laue diffraction patterns.-------------------
let u = new Array(3); // indices, pallarel to the incident beam
let v = new Array(3); // indices, another direction in the horizontal plane including the incidnet beam

let ux = new Array(3);
let vx = new Array(3);

let Rot0 = new Array(3);
let Rot1 = new Array(3);
let Rot2 = new Array(3);
let Rot =[Rot0, Rot1, Rot2];    // 3x3 rotation matrix

let a_unit = new Array(3);  // unit vector of primitive translation vectors
let b_unit = new Array(3);
let c_unit = new Array(3);

let a_star = new Array(3);  // reciprocal lattice vectors
let b_star = new Array(3);
let c_star = new Array(3);

let as_len;
let bs_len;
let cs_len;

let RefCon = '';

let Hmax;
let Kmax;
let Lmax;

let lambda_min=0.4;
let Qmax = 4.0*Math.PI/lambda_min;

let Omega=0;

//parameters regarding the detector banks
let Lsd = 40;   // Distance between the sample and detector (mm)
let DetHeight = 80; //height of the detector (mm)

//variables for 3D orientation viewer
const arrow_scale = 120;        //arrows for a*, b* and c*: convert A-1 to pixel.
const arrow_HeadLen = 20;       //lengths of arrowheads (pixel)
const arrow_HeadWidth = 10;     //widths of arrowheads (pixel)
const scale3D = 5;   // convert mm to pixel.
const DetBankThickness = 50; //pixel
let oriRenderer = null;   // WebGL renderer is created once and reused (avoids context leak).

//variable for loading observed Laue image.
let imageLoaded=false;
let imageURL;
let image = new Image();

//---- rotation tracking (new) -------------------------------------------
let rotTotals = {x:0.0, y:0.0, z:0.0};      // simple sums of button presses (order-dependent)
let Rtotal = [[1,0,0],[0,1,0],[0,0,1]];     // exact cumulative rotation matrix since origin
let rotHistory = [];                        // list of strings, e.g. "x+1"
const rotHistoryMaxShown = 60;

//---- view switching (new) ----------------------------------------------
let currentView = 'diffraction';            // 'diffraction' | 'projection'

//---- projection settings (new) -----------------------------------------
const projSize = 480;                       // canvas size (px), square
const projMargin = 0.90;                    // equator radius = projSize/2 * projMargin
let projSpotRadius = 4;                     // radius of circles showing reflections in the projection view (adjustable by the spot-size slider)
let poleRadius_tgt = 7;   // target-circle radius in the projection view (tracks the spot-size slider)

//---- hover data (new) ---------------------------------------------------
let detSpots = [];   // [{x,y,H,K,L,lambda}] in canvas pixels (physical indices)
let projPoles = [];  // [{x,y,h,k,l,chi,phi}] in canvas pixels (physical reduced indices)


window.addEventListener('load', () => {
    init_draw();

    document.getElementById('set_lattice_button').addEventListener('click', (evt) => {
        draw();
    });

    document.getElementById('RefCon').addEventListener('change', (evt) => {
        // Changing the reflection condition no longer resets the sample rotation.
        set_ReflectionCondition();
        draw_maps();
    });

    document.getElementById('colorSet').addEventListener('change', (evt) => {
        // Previously had no listener at all; the color scheme only changed on
        // the next unrelated redraw. Now it updates both views immediately.
        draw_maps();
    });

    document.getElementById('set_orientation_button').addEventListener('click', (evt) => {
        draw();
    });

    document.getElementById('set_target_ref_button').addEventListener('click', (evt) => {
        // Setting a target reflection no longer resets the sample rotation.
        draw_maps();
    });

    document.getElementById('lambda_min').addEventListener('input', (evt) => {
        lambda_adjust_and_draw();
    });

    document.getElementById('Q_max').addEventListener('input', (evt) => {
        lambda_adjust_and_draw();
    });

    const laue_pic_input = document.getElementById('laue_pic_file');
    laue_pic_input.addEventListener('change', (evt) => {       // this process will be executed when the element "laue_pic_file" has been changed.
        let input = evt.target;
        if (input.files.length == 0) {
            console.log('No file selected');
            return;
        }
        const file = input.files[0];
        getFile(file);
    });

    document.getElementById('file_remove_button').addEventListener('click', (evt) => {
        removeFile();
    });

    document.getElementById('rot_x_plus').addEventListener('click', (evt) => {
        rot_and_draw('rot_x_plus');
    });

    document.getElementById('rot_y_plus').addEventListener('click', (evt) => {
        rot_and_draw('rot_y_plus');
    });

    document.getElementById('rot_z_plus').addEventListener('click', (evt) => {
        rot_and_draw('rot_z_plus');
    });

    document.getElementById('rot_x_minus').addEventListener('click', (evt) => {
        rot_and_draw('rot_x_minus');
    });

    document.getElementById('rot_y_minus').addEventListener('click', (evt) => {
        rot_and_draw('rot_y_minus');
    });

    document.getElementById('rot_z_minus').addEventListener('click', (evt) => {
        rot_and_draw('rot_z_minus');
    });

    document.getElementById('rot_reset_button').addEventListener('click', (evt) => {
        // Restore the orientation defined by u and v ( = origin) and clear the counters.
        draw();
    });

    document.getElementById('rot_history_toggle').addEventListener('click', (evt) => {
        const box = document.getElementById('rot_history_box');
        const btn = document.getElementById('rot_history_toggle');
        if(box.style.display=='none'){
            box.style.display='block';
            btn.value='Hide history';
        }
        else{
            box.style.display='none';
            btn.value='Show history';
        }
    });

    document.getElementById('set_origin_button').addEventListener('click', (evt) => {
        set_Origin_and_draw();
    });

    document.getElementById('cam_theta').addEventListener('input', (evt) => {
        draw_OriViewer();
    });

    document.getElementById('cam_phi').addEventListener('input', (evt) => {
        draw_OriViewer();
    });

    //---- new event listeners ------------------------------------------
    document.getElementById('tab_diffraction').addEventListener('click', (evt) => {
        switchView('diffraction');
    });

    document.getElementById('tab_projection').addEventListener('click', (evt) => {
        switchView('projection');
    });

    document.getElementById('show_all_indices').addEventListener('change', (evt) => {
        draw_DetMap();
    });

    document.getElementById('proj_show_indices').addEventListener('change', (evt) => {
        draw_Projection();
    });

    document.getElementById('det_display_scale').addEventListener('input', (evt) => {
        apply_DetMap_DisplaySize();
    });

    document.getElementById('det_spot_radius').addEventListener('input', (evt) => {
        document.getElementById('det_spot_radius_disp').innerHTML = document.getElementById('det_spot_radius').value+" px";
        draw_DetMap();
    });

    document.getElementById('proj_spot_radius').addEventListener('input', (evt) => {
        document.getElementById('proj_spot_radius_disp').innerHTML = document.getElementById('proj_spot_radius').value+" px";
        draw_Projection();
    });

    document.getElementById('proj_display_scale').addEventListener('input', (evt) => {
        apply_Projection_DisplaySize();
    });

    document.getElementById('proj_img_scale').addEventListener('input', (evt) => {
        document.getElementById('proj_img_scale_disp').innerHTML = document.getElementById('proj_img_scale').value+"%";
        draw_Projection();
    });

    document.getElementById('proj_img_ofstx').addEventListener('change', (evt) => {
        draw_Projection();
    });

    document.getElementById('proj_img_ofsty').addEventListener('change', (evt) => {
        draw_Projection();
    });

    const detCanvas = document.getElementById('CanvasDetMap');
    detCanvas.addEventListener('mousemove', (evt) => {
        hover_DetMap(evt);
    });
    detCanvas.addEventListener('mouseleave', (evt) => {
        document.getElementById('spot_info').innerHTML = "Hover over a spot to inspect it.";
    });

    const projCanvas = document.getElementById('CanvasProjection');
    projCanvas.addEventListener('mousemove', (evt) => {
        hover_Projection(evt);
    });
    projCanvas.addEventListener('mouseleave', (evt) => {
        document.getElementById('pole_info').innerHTML = "Hover over a spot to inspect it.";
    });

});

function init_draw(){
    document.getElementById("verNum").innerHTML=version;
    document.getElementById("verNum2").innerHTML=version;
    draw();
}

function draw() {
    if(set_Lattice()==false){
        return;
    }
    reset_rotation_tracking();
    set_ReflectionCondition();
    lambda_adjust_and_draw();
    draw_OriViewer();
}

function draw_maps(){
    draw_DetMap();
    draw_Projection();
}

function rot_and_draw(rot_ax_dir) {
    rot_Lattice(rot_ax_dir);
    draw_maps();
    draw_OriViewer();
}

function lambda_adjust_and_draw(){
    document.getElementById("lambda_min_disp").value = document.getElementById("lambda_min").value;
    lambda_min = Number(document.getElementById("lambda_min").value);
    document.getElementById("Q_max_disp").value = document.getElementById("Q_max").value;
    Qmax = Number(document.getElementById("Q_max").value);
    draw_maps();
}

function set_Origin_and_draw(){
    X0_ofst = readNum('X0_ofst');
    Y0_ofst = -readNum('Y0_ofst');
    Lsd = readNum('Lsd');
    DetHeight = readNum('DetHeight');
    draw_maps();
}


//---- robust numeric input (new) -----------------------------------------
// Accepts comma decimal separators and full-width characters, writes the
// sanitized value back into the field, and returns a Number (NaN if invalid).
function readNum(id){
    const el = document.getElementById(id);
    let s = String(el.value);
    s = s.replace(/[\uFF10-\uFF19]/g, (ch)=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0)); // full-width digits
    s = s.replace(/[\uFF0E\u3002]/g, ".");     // full-width period
    s = s.replace(/[\uFF0C\u3001]/g, ",");     // full-width comma
    s = s.replace(/[\uFF0D\u2212\u30FC]/g, "-"); // full-width/long minus signs
    s = s.replace(/,/g, ".").trim();             // decimal comma -> period
    if(String(el.value)!==s){
        el.value = s;
    }
    return Number(s);
}

function set_Lattice(){

    //input parameters: lattice constants and sample orientation)
    let a = readNum('a');
    let b = readNum('b');
    let c = readNum('c');
    let alpha_deg = readNum('alpha');
    let beta_deg  = readNum('beta');
    let gamma_deg = readNum('gamma');
    let alpha = alpha_deg/180.0*Math.PI;   // in radian
    let beta  = beta_deg/180.0*Math.PI;    // in radian
    let gamma = gamma_deg/180.0*Math.PI;   // in radian
    u[0] = readNum('u1');
    u[1] = readNum('u2');
    u[2] = readNum('u3');
    v[0] = readNum('v1');
    v[1] = readNum('v2');
    v[2] = readNum('v3');

    // validation: invalid inputs previously produced a blank map with no warning.
    const problems = [];
    if(!(a>0)){ problems.push("a"); }
    if(!(b>0)){ problems.push("b"); }
    if(!(c>0)){ problems.push("c"); }
    if(!(alpha_deg>0 && alpha_deg<180)){ problems.push("alpha"); }
    if(!(beta_deg>0 && beta_deg<180)){ problems.push("beta"); }
    if(!(gamma_deg>0 && gamma_deg<180)){ problems.push("gamma"); }
    if(u.some((x)=>!isFinite(x)) || (u[0]==0&&u[1]==0&&u[2]==0)){ problems.push("u"); }
    if(v.some((x)=>!isFinite(x)) || (v[0]==0&&v[1]==0&&v[2]==0)){ problems.push("v"); }
    if(problems.length>0){
        alert("Invalid input: "+problems.join(", ")+"\n(Lattice constants must be positive numbers, angles must be between 0 and 180 deg., and u, v must be nonzero vectors. Use a period as the decimal separator.)");
        return false;
    }

    // calculation
    let DD = (Math.cos(alpha)-Math.cos(gamma)*Math.cos(beta))/Math.sin(gamma);
    let PP = Math.sqrt(Math.sin(beta)-DD**2.0);

    ux[0] = 2.0*Math.PI*u[0]/a;
    ux[1] = 2.0*Math.PI*(-u[0]/a/Math.tan(gamma)+u[1]/b/Math.sin(gamma));
    ux[2] = 2.0*Math.PI*(u[0]/a*(DD/Math.tan(gamma)-Math.cos(beta))-u[1]/b*DD/Math.sin(gamma)+u[2]/c)/PP;
    vx[0] = 2.0*Math.PI*v[0]/a;
    vx[1] = 2.0*Math.PI*(-v[0]/a/Math.tan(gamma)+v[1]/b/Math.sin(gamma));
    vx[2] = 2.0*Math.PI*(v[0]/a*(DD/Math.tan(gamma)-Math.cos(beta))-v[1]/b*DD/Math.sin(gamma)+v[2]/c)/PP;

    let uy2uz2 = ux[1]**2.0+ux[2]**2.0;
    let Uabs = Math.sqrt(ux[0]**2.0+uy2uz2);
    let Rvy;
    let Rvz;
    if(uy2uz2==0){
        Rvy=vx[1];
        Rvz=vx[2];
    }
    else{
        Rvy =(-vx[0]*ux[1]+(vx[1]*(ux[0]*ux[1]**2.0+Uabs*ux[2]**2.0)+vx[2]*ux[1]*ux[2]*(ux[0]-Uabs))/uy2uz2)/Uabs;
        Rvz =(-vx[0]*ux[2]+(vx[2]*(ux[0]*ux[2]**2.0+Uabs*ux[1]**2.0)+vx[1]*ux[2]*ux[1]*(ux[0]-Uabs))/uy2uz2)/Uabs;
    }

    let cosphi=Rvy/Math.sqrt(Rvy**2.0+Rvz**2.0);
    let sinphi=Rvz/Math.sqrt(Rvy**2.0+Rvz**2.0);

    Rot[0][0]= ux[0]/Uabs;
    Rot[0][1]= ux[1]/Uabs;
    Rot[0][2]= ux[2]/Uabs;
    Rot[1][0]= -(ux[1]*cosphi+ux[2]*sinphi)/Uabs;
    Rot[1][1]=(ux[2]*(ux[2]*cosphi-ux[1]*sinphi)+ux[0]*ux[1]*(ux[1]*cosphi+ux[2]*sinphi)/Uabs)/uy2uz2;
    Rot[1][2]=(ux[1]*(ux[1]*sinphi-ux[2]*cosphi)+ux[0]*ux[2]*(ux[2]*sinphi+ux[1]*cosphi)/Uabs)/uy2uz2;
    Rot[2][0]=(ux[1]*sinphi-ux[2]*cosphi)/Uabs;
    Rot[2][1]=(-ux[2]*(ux[1]*cosphi+ux[2]*sinphi)+ux[0]*ux[1]*(ux[2]*cosphi-ux[1]*sinphi)/Uabs)/uy2uz2;
    Rot[2][2]=(ux[1]*(ux[1]*cosphi+ux[2]*sinphi)+ux[0]*ux[2]*(ux[2]*cosphi-ux[1]*sinphi)/Uabs)/uy2uz2;

    for (let i=0;i<3;i++){
        a_unit[i]= Rot[i][0];
        b_unit[i]= Rot[i][0]*Math.cos(gamma)+Rot[i][1]*Math.sin(gamma);
        c_unit[i]= Rot[i][0]*Math.cos(beta)+Rot[i][1]*DD+Rot[i][2]*PP;
    }

    // output parameters: 3 reciprocal lattice vectors, a*, b*, and c*
    for (let i=0;i<3;i++){
        a_star[i]= 2.0*Math.PI/a/PP/Math.sin(gamma)*(b_unit[(i+1)%3]*c_unit[(i+2)%3]-b_unit[(i+2)%3]*c_unit[(i+1)%3]);
        b_star[i]= 2.0*Math.PI/b/PP/Math.sin(gamma)*(c_unit[(i+1)%3]*a_unit[(i+2)%3]-c_unit[(i+2)%3]*a_unit[(i+1)%3]);
        c_star[i]= 2.0*Math.PI/c/PP/Math.sin(gamma)*(a_unit[(i+1)%3]*b_unit[(i+2)%3]-a_unit[(i+2)%3]*b_unit[(i+1)%3]);
    }

    as_len = Math.sqrt(a_star[0]**2.0+a_star[1]**2.0+a_star[2]**2.0);
    bs_len = Math.sqrt(b_star[0]**2.0+b_star[1]**2.0+b_star[2]**2.0);
    cs_len = Math.sqrt(c_star[0]**2.0+c_star[1]**2.0+c_star[2]**2.0);

    return true;
}

function set_ReflectionCondition(){
    RefCon = document.getElementById("RefCon").value;
}

function check_ReflectionCondition(RefCon,H,K,L){
    let retstr=false;

    switch(RefCon){
        case 'none':
            retstr=true;
            break;
        case 'H+K=2n':
            if((H+K)%2==0){
                retstr=true;
            }
            break;
        case 'H+L=2n':
            if((H+L)%2==0){
                retstr=true;
            }
            break;
        case 'K+L=2n':
            if((K+L)%2==0){
                retstr=true;
            }
            break;
        case 'H+K+L=2n':
            if((H+K+L)%2==0){
                retstr=true;
            }
            break;
        case 'H,K,L all even or all odd':
            let hklsp = Math.abs(H%2)+Math.abs(K%2)+Math.abs(L%2);
            if(hklsp==0||hklsp==3){
                retstr=true;
            }
            break;
        case '-H+K+L=3n':
            if((-H+K+L)%3==0){
                retstr=true;
            }
            break;
        default:
            retstr=true;
    }
    return retstr;
}

// Compute a Bragg reflection (backscattering geometry).
// Returns null if the reflection does not appear, otherwise
// {PosX, PosY, lambda, Ghkl} where PosX/PosY are detector-map pixel coordinates
// (possibly outside the canvas).
function calcBraggReflection(H1,K1,L1){

    let Ghkl=new Array(3);
    for(let i=0;i<3;i++){
        Ghkl[i]=H1*a_star[i]+K1*b_star[i]+L1*c_star[i];
    }
    if(Ghkl[0]>=0.0){
        return null;    // Bragg's law is not satisfied.
    }

    let G_sq = Ghkl[0]**2.0+Ghkl[1]**2.0+Ghkl[2]**2.0;
    let ki = -0.5*G_sq/Ghkl[0]; // Ki >0
    let lam = 2.0*Math.PI/ki;    // Angstrome

    if(!(lam>lambda_min && G_sq > 0 && G_sq < Qmax**2.0)){
        // lambda_min=2PI/sqrt(Ei_max/2.072), the case that H=K=L=0 is avoided by the condition of  G_sq > 0.
        return null;
    }

    let kf=new Array(3);
    kf[0]=Ghkl[0]+ki;
    kf[1]=Ghkl[1];
    kf[2]=Ghkl[2];

    if(kf[0]>=0){
        //Backscattering condition: the scattered X-ray must go to -x direction, namely opposite to the incident x-ray direction.
        return null;
    }

    const mm2pixel=scaleY/DetHeight;
    let PosX=-kf[1]/kf[0]*Lsd*mm2pixel+X0+X0_ofst;
    let PosY=kf[2]/kf[0]*Lsd*mm2pixel+Y0+Y0_ofst;

    return {PosX:PosX, PosY:PosY, lambda:lam, Ghkl:Ghkl};
}


//---- on-screen display size control (new) --------------------------------
// Scales the canvas on screen via CSS only; the internal pixel resolution
// (used for coordinate calculations, hover picking, and PNG downloads)
// is untouched, so the underlying simulation is unaffected.
const detDisplayMinW = 250;
const detDisplayMaxW = 1200;   // matches the original default wide-canvas width

function computeBaselineSize(nativeW, nativeH, minW, maxW){
    let scale = 1.0;
    if(nativeW > maxW){
        scale = maxW/nativeW;
    }
    else if(nativeW < minW){
        scale = minW/nativeW;
    }
    return [nativeW*scale, nativeH*scale];
}

function apply_DetMap_DisplaySize(){
    const canvas = document.getElementById('CanvasDetMap');
    const [baseW, baseH] = computeBaselineSize(canvas.width, canvas.height, detDisplayMinW, detDisplayMaxW);
    const pct = Number(document.getElementById('det_display_scale').value)/100.0;
    canvas.style.width = (baseW*pct)+"px";
    canvas.style.height = (baseH*pct)+"px";
    document.getElementById('det_display_scale_disp').innerHTML = document.getElementById('det_display_scale').value+"%";
}

function apply_Projection_DisplaySize(){
    const canvas = document.getElementById('CanvasProjection');
    const [baseW, baseH] = computeBaselineSize(canvas.width, canvas.height, 250, 700);
    const pct = Number(document.getElementById('proj_display_scale').value)/100.0;
    canvas.style.width = (baseW*pct)+"px";
    canvas.style.height = (baseH*pct)+"px";
    document.getElementById('proj_display_scale_disp').innerHTML = document.getElementById('proj_display_scale').value+"%";
}

function apply_ColorSet(){
    // Sets the shared fundamental_color / DetMapBGColor / gridcolor variables
    // used by both the diffraction (detector) map and the projection view,
    // so a color-scheme change is reflected in both.
    switch(document.getElementById('colorSet').value){
        case 'colorSet1':
            fundamental_color=fundamental_color1;
            DetMapBGColor=DetMapBGColor1;
            gridcolor=gridcolor1;
            break;
        case 'colorSet2':
            fundamental_color=fundamental_color2;
            DetMapBGColor=DetMapBGColor2;
            gridcolor=gridcolor2;
            break;
        default:
            fundamental_color=fundamental_color1;
            DetMapBGColor=DetMapBGColor1;
            gridcolor=gridcolor1;
            break;
    }
}

function draw_DetMap(){

    let canvas = document.getElementById('CanvasDetMap');
    if(imageLoaded==false){
        if(document.getElementById('detShape_square').checked==true){
            scaleX=scaleY_default;
            scaleY=scaleY_default;
            X0=scaleY_default/2.0;
            Y0=scaleY_default/2.0;
        }
        else{
            scaleX=scaleX_default;
            scaleY=scaleY_default;
            X0=scaleX_default/2.0;
            Y0=scaleY_default/2.0;
        }
    }
    canvas.width=scaleX;
    canvas.height=scaleY;

    radius = readNum('det_spot_radius');
    if(!(radius>0)){ radius=5; }
    txt_ofst1 = radius+10;
    radius_tgt = radius+3;

    apply_ColorSet();

    let context = canvas.getContext('2d');

    //refresh
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgb(0, 0, 0)";
    context.lineWidth=1;


    //set background color
    context.fillStyle = DetMapBGColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    //show observed Laue pattern
    if(imageLoaded==true){
        context.drawImage(image, 0, 0);
    }

    context.strokeStyle = gridcolor;
    context.beginPath();
    context.moveTo(0,Y0+Y0_ofst);
    context.lineTo(scaleX,Y0+Y0_ofst);
    context.stroke();

    context.strokeStyle = gridcolor;
    context.beginPath();
    context.moveTo(X0+X0_ofst,0);
    context.lineTo(X0+X0_ofst,scaleY);
    context.stroke();

    // color setting for circles indicating reflections
    context.strokeStyle = fundamental_color;
    context.fillStyle = fundamental_color;
    context.lineWidth= ref_linewidth;
    context.font = "10px sans-serif";

    Hmax = Math.floor(Qmax/as_len*2.0);
    Kmax = Math.floor(Qmax/bs_len*2.0);
    Lmax = Math.floor(Qmax/cs_len*2.0);

    const showAllHKL = document.getElementById('show_all_indices').checked;

    detSpots = [];

    for (let H=-Hmax;H<=Hmax;H+=1){
        for (let K=-Kmax;K<=Kmax;K+=1){
            for (let L=-Lmax;L<=Lmax;L+=1){

                if(check_ReflectionCondition(RefCon,H,K,L)==false){
                    // Reflection condition is not satisfied.
                    continue;
                }

                const ref = calcBraggReflection(H,K,L);
                if(ref==null){
                    continue;
                }
                if(ref.PosX>=0 && ref.PosX<scaleX && ref.PosY >= 0 && ref.PosY <=scaleY){
                    context.beginPath();
                    context.arc(ref.PosX,ref.PosY, radius, 0, 2 * Math.PI);
                    context.stroke();

                    if(showAllHKL==true){
                        //Thus far, the Bragg conditions are calculated assuming that the scattering vector is defined as Q=kf-ki.
                        //However, the correct definition of the scattering vector is Q=ki-kf, which is momentum of the excitation. Thus, "-" signs are necessary to change Q=kf-ki to Q=ki-kf.
                        context.fillText(String(-H)+String(-K)+String(-L), ref.PosX, ref.PosY+txt_ofst1);
                    }

                    detSpots.push({x:ref.PosX, y:ref.PosY, H:-H, K:-K, L:-L, lambda:ref.lambda});
                }
            }
        }
    }

    //draw large circle for the target reflection.
    context.strokeStyle = fundamental_color;
    let Ht=-readNum('Ht');
    let Kt=-readNum('Kt');
    let Lt=-readNum('Lt');
    //minus signs are necessary to convert Q=kf-ki to Q=ki-kf.
    const tref = calcBraggReflection(Ht,Kt,Lt);
    if(tref!=null && tref.PosX>=0 && tref.PosX<scaleX && tref.PosY >= 0 && tref.PosY <=scaleY){
        context.beginPath();
        context.arc(tref.PosX,tref.PosY, radius_tgt, 0, 2 * Math.PI);
        context.stroke();
        context.fillText(String(-Ht)+String(-Kt)+String(-Lt), tref.PosX, tref.PosY+txt_ofst1);
    }

    apply_DetMap_DisplaySize();

    window.URL.revokeObjectURL(document.getElementById('DetMap_download').href);
    canvas.toBlob((blob)=>{
        document.getElementById('DetMap_download').href=window.URL.createObjectURL(blob);
    });

}

//---- stereographic projection view (new) --------------------------------
// The projection is viewed along the incident beam axis (x axis).
// For each reflection appearing under the current conditions (Bragg law,
// lambda_min, Qmax, backscattering), the pole ( = direction of the plane
// normal facing the detector side, n = G/|G| with n_x<0 ) is projected
// stereographically from the pole (+1,0,0) onto the plane x=0:
//   (py, pz) = (n_y, n_z) / (1 - n_x).
// The screen orientation matches the detector map: right = +y, up = +z,
// so a spot and its pole appear in the same azimuthal direction.

function gcd2(p,q){
    p=Math.abs(p); q=Math.abs(q);
    while(q){ const t=q; q=p%q; p=t; }
    return p;
}

function reduceHKL(H,K,L){
    let g = gcd2(gcd2(H,K),L);
    if(g==0){ g=1; }
    return [H/g, K/g, L/g];
}

// Overlay the observed image on the projection view AS-IS (no geometric
// transformation): the loaded image is assumed to be saved already in
// projection coordinates by the measurement software. By default the image is
// fitted into the square canvas (aspect ratio preserved, centered); its size
// and position can be adjusted to align with the simulated poles.
function draw_ProjectionImageOverlay(ctx, cx, cy, Req){
    if(imageLoaded==false){
        return;
    }
    const iw = image.width;
    const ih = image.height;
    if(!(iw>0 && ih>0)){
        return;
    }
    const fit = Math.min(projSize/iw, projSize/ih);   // contain-fit baseline
    const pct = readNum('proj_img_scale')/100.0;
    const s = fit*(isFinite(pct)&&pct>0 ? pct : 1.0);
    let dx = readNum('proj_img_ofstx');
    let dy = readNum('proj_img_ofsty');
    if(!isFinite(dx)){ dx=0; }
    if(!isFinite(dy)){ dy=0; }
    const w = iw*s;
    const h = ih*s;
    ctx.drawImage(image, cx-w/2.0+dx, cy-h/2.0-dy, w, h);   // +dy moves the image up (same sense as the detector-map Y offset)
}

function draw_Projection(){
    // "Projection" view = the diffraction pattern with the flat-detector
    // distortion removed. Each Bragg spot appearing on the detector is placed
    // by the DIRECTION of its scattered beam kf (stereographic mapping:
    // radius = tan(theta/2), theta = angle of kf from the backward direction),
    // instead of by its position on the flat detector (radius = Lsd*tan(theta)).
    // Spots therefore correspond one-to-one with the diffraction view, with
    // the same azimuth (right = +y, up = +z); only the radial scale changes.

    const canvas = document.getElementById('CanvasProjection');
    canvas.width = projSize;
    canvas.height = projSize;
    const ctx = canvas.getContext('2d');

    const cx = projSize/2.0;
    const cy = projSize/2.0;
    const Req = projSize/2.0*projMargin;   // theta = 90 deg. (backscattering limit)

    projSpotRadius = readNum('proj_spot_radius');
    if(!(projSpotRadius>0)){ projSpotRadius=4; }
    poleRadius_tgt = projSpotRadius+3;

    apply_ColorSet();

    ctx.clearRect(0,0,projSize,projSize);
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillRect(0,0,projSize,projSize);

    // observed Laue image (drawn as-is; assumed to be in projection coordinates)
    draw_ProjectionImageOverlay(ctx, cx, cy, Req);

    // guide circles: theta = 30, 60 (dashed) and 90 deg (solid)
    ctx.strokeStyle = gridcolor;
    ctx.lineWidth = 1;
    for(const th of [30,60]){
        const r = Req*Math.tan(th/2.0/180.0*Math.PI);
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.arc(cx,cy,r,0,2*Math.PI);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx,cy,Req,0,2*Math.PI);
    ctx.stroke();

    // crosshair
    ctx.beginPath();
    ctx.moveTo(cx-Req,cy);
    ctx.lineTo(cx+Req,cy);
    ctx.moveTo(cx,cy-Req);
    ctx.lineTo(cx,cy+Req);
    ctx.stroke();

    // theta labels on the guides
    ctx.fillStyle = gridcolor;
    ctx.font = "10px sans-serif";
    for(const th of [30,60,90]){
        const r = Req*Math.tan(th/2.0/180.0*Math.PI);
        ctx.fillText(String(th)+"\u00B0", cx+r*0.7071+2, cy-r*0.7071-2);
    }

    if(as_len==undefined){
        return;
    }

    Hmax = Math.floor(Qmax/as_len*2.0);
    Kmax = Math.floor(Qmax/bs_len*2.0);
    Lmax = Math.floor(Qmax/cs_len*2.0);

    const showHKL = document.getElementById('proj_show_indices').checked;

    // Map a computed reflection to projection-canvas coordinates.
    // Returns null if the spot does not hit the detector (so this view shows
    // exactly the same set of reflections as the diffraction view).
    const spotToProj = (ref)=>{
        if(!(ref.PosX>=0 && ref.PosX<scaleX && ref.PosY>=0 && ref.PosY<=scaleY)){
            return null;
        }
        const ki = 2.0*Math.PI/ref.lambda;
        const kf = [ref.Ghkl[0]+ki, ref.Ghkl[1], ref.Ghkl[2]];   // kf[0] < 0 (backscattering)
        const klen = Math.sqrt(kf[0]**2.0+kf[1]**2.0+kf[2]**2.0);
        const m = [kf[0]/klen, kf[1]/klen, kf[2]/klen];
        const py = m[1]/(1.0-m[0]);
        const pz = m[2]/(1.0-m[0]);
        const theta = Math.acos(Math.min(1.0,Math.max(-1.0,-m[0])))*180.0/Math.PI;  // scattering direction angle from the backward axis
        return {x: cx + py*Req, y: cy - pz*Req, theta: theta};
    };

    projPoles = [];

    ctx.strokeStyle = fundamental_color;
    ctx.fillStyle = fundamental_color;
    ctx.lineWidth = ref_linewidth;

    for (let H=-Hmax;H<=Hmax;H+=1){
        for (let K=-Kmax;K<=Kmax;K+=1){
            for (let L=-Lmax;L<=Lmax;L+=1){
                if(check_ReflectionCondition(RefCon,H,K,L)==false){
                    continue;
                }
                const ref = calcBraggReflection(H,K,L);
                if(ref==null){
                    continue;
                }
                const p = spotToProj(ref);
                if(p==null){
                    continue;
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, projSpotRadius, 0, 2*Math.PI);
                ctx.stroke();
                if(showHKL==true){
                    ctx.fillText(String(-H)+String(-K)+String(-L), p.x, p.y+projSpotRadius+8);
                }
                projPoles.push({x:p.x, y:p.y, H:-H, K:-K, L:-L, lambda:ref.lambda, theta:p.theta});
            }
        }
    }

    // target reflection (large circle, same convention as the diffraction view)
    let tgtInfo = "Target reflection: not set.";
    const Ht = readNum('Ht');
    const Kt = readNum('Kt');
    const Lt = readNum('Lt');
    if(!(Ht==0 && Kt==0 && Lt==0)){
        const tref = calcBraggReflection(-Ht,-Kt,-Lt);   // minus signs: convert Q=kf-ki to Q=ki-kf.
        if(tref!=null){
            const p = spotToProj(tref);
            if(p!=null){
                ctx.strokeStyle = gridcolor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, poleRadius_tgt, 0, 2*Math.PI);
                ctx.stroke();
                ctx.fillStyle = gridcolor;
                ctx.fillText(String(Ht)+String(Kt)+String(Lt), p.x+6, p.y+14);
                ctx.strokeStyle = fundamental_color;
                ctx.fillStyle = fundamental_color;
                ctx.lineWidth = ref_linewidth;
                tgtInfo = "Target reflection ("+String(Ht)+", "+String(Kt)+", "+String(Lt)+"): "
                         +"\u03B8 = "+p.theta.toFixed(2)+"\u00B0 from the beam axis "
                         +"(pole tilt \u03C7 = \u03B8/2 = "+(p.theta/2.0).toFixed(2)+"\u00B0).";
            }
            else{
                tgtInfo = "Target reflection ("+String(Ht)+", "+String(Kt)+", "+String(Lt)+"): outside the detector area.";
            }
        }
        else{
            tgtInfo = "Target reflection ("+String(Ht)+", "+String(Kt)+", "+String(Lt)+"): does not satisfy the current diffraction conditions.";
        }
    }
    document.getElementById('target_pole_info').innerHTML = tgtInfo;

    apply_Projection_DisplaySize();

    window.URL.revokeObjectURL(document.getElementById('Projection_download').href);
    canvas.toBlob((blob)=>{
        document.getElementById('Projection_download').href=window.URL.createObjectURL(blob);
    });

}

//---- view switching (new) ------------------------------------------------
function switchView(view){
    currentView = view;
    if(view=='diffraction'){
        document.getElementById('view_diffraction').style.display='block';
        document.getElementById('view_projection').style.display='none';
        document.getElementById('tab_diffraction').classList.add('tab_active');
        document.getElementById('tab_projection').classList.remove('tab_active');
    }
    else{
        document.getElementById('view_diffraction').style.display='none';
        document.getElementById('view_projection').style.display='block';
        document.getElementById('tab_diffraction').classList.remove('tab_active');
        document.getElementById('tab_projection').classList.add('tab_active');
    }
}

//---- hover inspection (new) ---------------------------------------------
function canvasCoords(canvas, evt){
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX-rect.left)*canvas.width/rect.width;
    const y = (evt.clientY-rect.top)*canvas.height/rect.height;
    return [x,y];
}

function hover_DetMap(evt){
    const canvas = document.getElementById('CanvasDetMap');
    const [mx,my] = canvasCoords(canvas, evt);
    let best=null;
    let bestD=100;   // (10 px)^2
    for(const s of detSpots){
        const d=(s.x-mx)**2.0+(s.y-my)**2.0;
        if(d<bestD){ bestD=d; best=s; }
    }
    const el = document.getElementById('spot_info');
    if(best==null){
        el.innerHTML = "Hover over a spot to inspect it.";
    }
    else{
        // A Laue spot is generally a superposition of harmonics (nH,nK,nL):
        // collect all reflections located at (almost) the same position.
        const coloc = detSpots.filter(s => (s.x-best.x)**2.0+(s.y-best.y)**2.0 < 1.0);
        coloc.sort((p,q)=>(Math.abs(p.H)+Math.abs(p.K)+Math.abs(p.L))-(Math.abs(q.H)+Math.abs(q.K)+Math.abs(q.L)));
        const maxShown = 4;
        let list = coloc.slice(0,maxShown)
            .map(s=>"("+String(s.H)+", "+String(s.K)+", "+String(s.L)+") &lambda;="+s.lambda.toFixed(3)+" &Aring;")
            .join(" / ");
        if(coloc.length>maxShown){
            list += " / +"+String(coloc.length-maxShown)+" more";
        }
        const mm2pixel=scaleY/DetHeight;
        const xmm=(best.x-X0-X0_ofst)/mm2pixel;
        const ymm=-(best.y-Y0-Y0_ofst)/mm2pixel;
        el.innerHTML = list+", position = ("+xmm.toFixed(1)+", "+ymm.toFixed(1)+") mm";
    }
}

function hover_Projection(evt){
    const canvas = document.getElementById('CanvasProjection');
    const [mx,my] = canvasCoords(canvas, evt);
    let best=null;
    let bestD=100;
    for(const p of projPoles){
        const d=(p.x-mx)**2.0+(p.y-my)**2.0;
        if(d<bestD){ bestD=d; best=p; }
    }
    const el = document.getElementById('pole_info');
    if(best==null){
        el.innerHTML = "Hover over a spot to inspect it.";
    }
    else{
        const coloc = projPoles.filter(s => (s.x-best.x)**2.0+(s.y-best.y)**2.0 < 1.0);
        coloc.sort((p,q)=>(Math.abs(p.H)+Math.abs(p.K)+Math.abs(p.L))-(Math.abs(q.H)+Math.abs(q.K)+Math.abs(q.L)));
        const maxShown = 4;
        let list = coloc.slice(0,maxShown)
            .map(s=>"("+String(s.H)+", "+String(s.K)+", "+String(s.L)+") &lambda;="+s.lambda.toFixed(3)+" &Aring;")
            .join(" / ");
        if(coloc.length>maxShown){
            list += " / +"+String(coloc.length-maxShown)+" more";
        }
        el.innerHTML = list+", &theta; = "+best.theta.toFixed(2)+"&deg; from the beam axis";
    }
}

//---- rotation tracking (new) --------------------------------------------
function reset_rotation_tracking(){
    rotTotals = {x:0.0, y:0.0, z:0.0};
    Rtotal = [[1,0,0],[0,1,0],[0,0,1]];
    rotHistory = [];
    update_rotation_display();
}

function matmul3(A,B){
    const C=[[0,0,0],[0,0,0],[0,0,0]];
    for(let i=0;i<3;i++){
        for(let j=0;j<3;j++){
            for(let k=0;k<3;k++){
                C[i][j]+=A[i][k]*B[k][j];
            }
        }
    }
    return C;
}

function track_rotation(xyz, angle){
    // xyz: 0=x, 1=y, 2=z, angle in radian
    const deg = angle*180.0/Math.PI;
    const axname = ['x','y','z'][xyz];
    rotTotals[axname] += deg;
    rotHistory.push(axname+(deg>=0?"+":"\u2212")+Math.abs(deg).toFixed(3).replace(/\.?0+$/,""));

    // rotation matrix consistent with xyz_rotation():
    // v[i1]' = v[i1]cos - v[i2]sin ; v[i2]' = v[i1]sin + v[i2]cos, (i1,i2)=((xyz+1)%3,(xyz+2)%3)
    const c=Math.cos(angle);
    const s=Math.sin(angle);
    const i1=(xyz+1)%3;
    const i2=(xyz+2)%3;
    const M=[[0,0,0],[0,0,0],[0,0,0]];
    M[xyz][xyz]=1.0;
    M[i1][i1]=c;
    M[i1][i2]=-s;
    M[i2][i1]=s;
    M[i2][i2]=c;
    Rtotal = matmul3(M,Rtotal);

    update_rotation_display();
}

function update_rotation_display(){
    // per-axis button totals (order-dependent)
    const fmt=(v)=>((v>=0?"+":"\u2212")+Math.abs(v).toFixed(2)+"\u00B0");
    document.getElementById('rot_totals').innerHTML =
        "&Delta;x: "+fmt(rotTotals.x)+", &Delta;y: "+fmt(rotTotals.y)+", &Delta;z: "+fmt(rotTotals.z);

    // exact net rotation from the cumulative matrix
    const tr = Rtotal[0][0]+Rtotal[1][1]+Rtotal[2][2];
    const cosT = Math.min(1.0, Math.max(-1.0, (tr-1.0)/2.0));
    const theta = Math.acos(cosT);
    const thetaDeg = theta*180.0/Math.PI;
    let netStr;
    if(thetaDeg < 1e-4){
        netStr = "0.00\u00B0 (at origin)";
    }
    else{
        const s2 = 2.0*Math.sin(theta);
        if(Math.abs(s2) < 1e-8){
            netStr = thetaDeg.toFixed(2)+"\u00B0";
        }
        else{
            const ax = (Rtotal[2][1]-Rtotal[1][2])/s2;
            const ay = (Rtotal[0][2]-Rtotal[2][0])/s2;
            const az = (Rtotal[1][0]-Rtotal[0][1])/s2;
            netStr = thetaDeg.toFixed(2)+"\u00B0 about axis ("
                    +ax.toFixed(3)+", "+ay.toFixed(3)+", "+az.toFixed(3)+")";
        }
    }
    document.getElementById('rot_net').innerHTML = "Net rotation from origin: "+netStr;

    // history
    const hist = rotHistory.slice(-rotHistoryMaxShown);
    document.getElementById('rot_history').innerHTML =
        (rotHistory.length>rotHistoryMaxShown ? "&hellip; " : "") + hist.join(", ");
}


function rot_Lattice(rot_ax_dir){
    let angle = 0.0;  // radian unit
    let xyz;          // xyz=(0,1,2) for (x, y, z)-axis respectively.
    switch(rot_ax_dir){
        case 'rot_x_plus':
            angle = readNum('rot_x_deg')/180.0*Math.PI;
            xyz =0;
            break;
        case 'rot_x_minus':
            angle = (-1.0)*readNum('rot_x_deg')/180.0*Math.PI;
            xyz =0;
            break;
        case 'rot_y_plus':
            angle = readNum('rot_y_deg')/180.0*Math.PI;
            xyz =1;
            break;
        case 'rot_y_minus':
            angle = (-1.0)*readNum('rot_y_deg')/180.0*Math.PI;
            xyz =1;
            break;
        case 'rot_z_plus':
            angle = readNum('rot_z_deg')/180.0*Math.PI;
            xyz =2;
            break;
        case 'rot_z_minus':
            angle = (-1.0)*readNum('rot_z_deg')/180.0*Math.PI;
            xyz =2;
            break;
        default:
            return;
    }
    xyz_rotation(xyz,angle);
    track_rotation(xyz,angle);
}

function xyz_rotation(xyz,angle){
    //xyz : 0=x, 1=y, 2=z
    //angle : rotation angle (radian units)
    let r00;
    let r01;

    r00=a_star[(xyz+1)%3]*Math.cos(angle)-a_star[(xyz+2)%3]*Math.sin(angle);
    r01=a_star[(xyz+1)%3]*Math.sin(angle)+a_star[(xyz+2)%3]*Math.cos(angle);
    a_star[(xyz+1)%3]=r00;
    a_star[(xyz+2)%3]=r01;
    r00=b_star[(xyz+1)%3]*Math.cos(angle)-b_star[(xyz+2)%3]*Math.sin(angle);
    r01=b_star[(xyz+1)%3]*Math.sin(angle)+b_star[(xyz+2)%3]*Math.cos(angle);
    b_star[(xyz+1)%3]=r00;
    b_star[(xyz+2)%3]=r01;
    r00=c_star[(xyz+1)%3]*Math.cos(angle)-c_star[(xyz+2)%3]*Math.sin(angle);
    r01=c_star[(xyz+1)%3]*Math.sin(angle)+c_star[(xyz+2)%3]*Math.cos(angle);
    c_star[(xyz+1)%3]=r00;
    c_star[(xyz+2)%3]=r01;
}

function draw_OriViewer(){
    // canvas size
    const width = 800;
    const height = 400;

    // The WebGL renderer is created only once and reused
    // (creating a new one on every redraw leaks WebGL contexts).
    if(oriRenderer==null){
        oriRenderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#OrientationViewer'),
            antialias: true
        });
        oriRenderer.setPixelRatio(window.devicePixelRatio);
        oriRenderer.setSize(width, height);
        oriRenderer.setClearColor(0xf8f8f8);
    }
    const renderer = oriRenderer;

    // scene
    const scene = new THREE.Scene();

    // camera
    const camera = new THREE.PerspectiveCamera(30, width / height);
    let cam_theta=Number(document.getElementById("cam_theta").value);
    let cam_phi=Number(document.getElementById("cam_phi").value);
    let cam_len=1200;
    camera.position.set(cam_len*Math.sin(Math.PI/180.0*cam_theta)*Math.sin(Math.PI/180.0*cam_phi), cam_len*Math.cos(Math.PI/180.0*cam_theta), cam_len*Math.sin(Math.PI/180.0*cam_theta)*Math.cos(Math.PI/180.0*cam_phi));
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // detector
    const material1 = new THREE.MeshStandardMaterial({ color: 0xC0C0C0 });  // color of detector bank
    let geometry_det = new THREE.BoxGeometry(DetBankThickness,DetHeight*scale3D,DetHeight/scaleY*scaleX*scale3D);
    let mesh_det = new THREE.Mesh(geometry_det, material1);
    scene.add(mesh_det);
    mesh_det.position.x -= Lsd*scale3D;

    // guide for the incident beam
    const geometry_guide = new THREE.BoxGeometry(1000,50,50);
    const mesh_guide = new THREE.Mesh(geometry_guide, material1);
    scene.add(mesh_guide);
    mesh_guide.position.x -= Lsd*scale3D+500;

    //draw a*, b*, c*
    //a*
    let dir = new THREE.Vector3( a_star[0],a_star[2], -a_star[1] );
    let origin = new THREE.Vector3( 0, 0, 0 );
    let arrow_len = dir.length()*arrow_scale;
    let hex = 0xff0000;
    let arrowHelper = new THREE.ArrowHelper( dir.normalize(), origin, arrow_len, hex ,arrow_HeadLen,arrow_HeadWidth);
    scene.add(arrowHelper);

    //b*
    dir = new THREE.Vector3( b_star[0],b_star[2], -b_star[1] );
    arrow_len = dir.length()*arrow_scale;
    hex = 0x00ff00;
    arrowHelper = new THREE.ArrowHelper( dir.normalize(), origin, arrow_len, hex ,arrow_HeadLen,arrow_HeadWidth);
    scene.add(arrowHelper);

    //c*
    dir = new THREE.Vector3( c_star[0],c_star[2], -c_star[1] );
    arrow_len = dir.length()*arrow_scale;
    hex = 0x0000ff;
    arrowHelper = new THREE.ArrowHelper( dir.normalize(), origin,arrow_len, hex ,arrow_HeadLen,arrow_HeadWidth);
    scene.add(arrowHelper);

    //ki*
    dir = new THREE.Vector3( 1,0, 0 );
    arrow_len = dir.length()*arrow_scale;
    hex = 0xff9900;
    let origin2 = new THREE.Vector3( -Lsd*scale3D, 0, 0 );
    arrowHelper = new THREE.ArrowHelper( dir.normalize(), origin2,Lsd*scale3D, hex ,arrow_HeadLen,arrow_HeadWidth);
    scene.add(arrowHelper);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(150, 240, -500);
    scene.add(directionalLight);

    const light = new THREE.AmbientLight(0xa0a0a0, 1.0);
    scene.add(light);

    renderer.render(scene, camera);

  }

function getFile(file){
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function() {
        imageLoaded=true;
        image.src = reader.result;
        image.onload=function() {
            scaleX=image.width;
            scaleY=image.height;
            X0=scaleX/2;
            Y0=scaleY/2;
            draw_maps();
            draw_OriViewer();
        };
    };
}


function removeFile(){
    imageLoaded=false;
    draw_maps();
}



//--------------------------------------
