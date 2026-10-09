import type { Exercise } from '../types';

/**
 * Common gym exercises missing from free-exercise-db, written for this app. No photos yet,
 * so they show a placeholder and a link to a form video.
 */
type Row = [
  name: string,
  equipment: string,
  mechanic: 'compound' | 'isolation',
  primary: string[],
  secondary: string[],
  instructions: string[],
  category?: string,
];

const ROWS: Row[] = [
  // Legs and glutes
  ['Machine Hip Thrust', 'machine', 'compound', ['glutes'], ['hamstrings'], [
    'Sit with your upper back against the pad and the belt across your hips, feet flat and shoulder-width apart.',
    'Drive through your heels to lift your hips until your body is straight from shoulders to knees.',
    'Squeeze your glutes for a second at the top, then lower under control.',
  ]],
  ['Dumbbell Hip Thrust', 'dumbbell', 'compound', ['glutes'], ['hamstrings'], [
    'Sit with your upper back against a bench and a dumbbell resting on your hips.',
    'Plant your feet and drive your hips up until your thighs and torso are level.',
    'Pause and squeeze your glutes, then lower slowly.',
  ]],
  ['Bulgarian Split Squat', 'dumbbell', 'compound', ['quadriceps'], ['glutes', 'hamstrings'], [
    'Hold a dumbbell in each hand and stand a stride in front of a bench, resting the top of your back foot on it.',
    'Lower straight down until your front thigh is about parallel to the floor.',
    'Push through your front foot to stand back up. Finish all reps, then switch legs.',
  ]],
  ['Hack Squat Machine', 'machine', 'compound', ['quadriceps'], ['glutes'], [
    'Stand on the platform with your back and shoulders against the pads, feet shoulder-width apart.',
    'Release the safety handles and bend your knees to lower until your thighs are at least parallel to the platform.',
    'Drive through your whole foot to straighten your legs without locking your knees.',
  ]],
  ['Pendulum Squat', 'machine', 'compound', ['quadriceps'], ['glutes'], [
    'Set your shoulders under the pads and feet in the middle of the platform.',
    'Unlock the machine and sit down as deep as you can while keeping your heels down.',
    'Press back up to just short of locking your knees.',
  ]],
  ['Belt Squat', 'machine', 'compound', ['quadriceps'], ['glutes', 'adductors'], [
    'Attach the belt around your hips and stand on the platform with feet a little wider than shoulder-width.',
    'Squat down while keeping your chest up, letting the belt pull your hips straight down.',
    'Stand back up by driving through your feet.',
  ]],
  ['Single-Leg Leg Press', 'machine', 'compound', ['quadriceps'], ['glutes', 'hamstrings'], [
    'Sit in the leg press and place one foot in the middle of the platform.',
    'Release the safeties and lower until your knee is bent to about 90 degrees.',
    'Press back up without locking your knee. Finish all reps, then switch legs.',
  ]],
  ['Pause Squat', 'barbell', 'compound', ['quadriceps'], ['glutes', 'hamstrings', 'lower back'], [
    'Set up as for a normal back squat with the bar on your upper back.',
    'Squat down to your usual depth and hold the bottom position still for 2–3 seconds while staying tight.',
    'Drive back up without bouncing.',
  ]],
  ['Heel-Elevated Goblet Squat', 'dumbbell', 'compound', ['quadriceps'], ['glutes'], [
    'Stand with your heels on a small plate or wedge, holding a dumbbell vertically against your chest.',
    'Squat down with your knees travelling forward over your toes, keeping your chest tall.',
    'Stand back up by pushing through the middle of your feet.',
  ]],
  ['Cossack Squat', 'body only', 'compound', ['adductors'], ['quadriceps', 'glutes'], [
    'Stand with your feet very wide and toes slightly out.',
    'Shift your weight to one side and squat down on that leg while the other stays straight with its toes up.',
    'Push back to the middle and repeat on the other side.',
  ]],
  ['Curtsy Lunge', 'dumbbell', 'compound', ['glutes'], ['quadriceps', 'adductors'], [
    'Stand tall holding dumbbells at your sides.',
    'Step one foot diagonally behind the other, as if curtsying, and lower until your front thigh is near parallel.',
    'Push through your front foot to return to standing. Alternate sides.',
  ]],
  ['Dumbbell Romanian Deadlift', 'dumbbell', 'compound', ['hamstrings'], ['glutes', 'lower back'], [
    'Stand holding dumbbells in front of your thighs, knees slightly bent.',
    'Push your hips back and slide the dumbbells down your legs, keeping your back flat, until you feel a strong stretch in your hamstrings.',
    'Drive your hips forward to stand back up and squeeze your glutes.',
  ]],
  ['Single-Leg Romanian Deadlift', 'dumbbell', 'compound', ['hamstrings'], ['glutes', 'lower back'], [
    'Stand on one leg holding a dumbbell in the opposite hand.',
    'Hinge at the hip, letting your free leg extend behind you, until your torso is close to parallel with the floor.',
    'Return to standing by driving your hips forward. Finish all reps, then switch sides.',
  ]],
  ['Nordic Hamstring Curl', 'body only', 'isolation', ['hamstrings'], ['glutes'], [
    'Kneel on a pad with your ankles anchored under something solid or held by a partner.',
    'Keeping your body straight from knees to head, lower yourself toward the floor as slowly as you can.',
    'Catch yourself with your hands, then push off lightly and pull back up with your hamstrings.',
  ]],
  ['Glute Kickback Machine', 'machine', 'isolation', ['glutes'], ['hamstrings'], [
    'Set up on the machine with your forearms or chest on the pad and one foot against the lever.',
    'Push the lever back and up by extending your hip until your leg is in line with your body.',
    'Squeeze your glute, then return slowly. Finish all reps, then switch legs.',
  ]],
  ['Tibialis Raise', 'body only', 'isolation', ['calves'], [], [
    'Lean your back against a wall with your heels about a foot in front of you.',
    'Lift your toes as high as you can toward your shins, keeping your heels on the floor.',
    'Lower slowly and repeat.',
  ]],
  ['Seated Calf Raise Machine', 'machine', 'isolation', ['calves'], [], [
    'Sit with the balls of your feet on the platform and the pad on your lower thighs.',
    'Release the safety and lower your heels as far as they go for a full stretch.',
    'Push up onto your toes as high as you can, pause, and lower slowly.',
  ]],
  // Chest
  ['Low-to-High Cable Fly', 'cable', 'isolation', ['chest'], ['shoulders'], [
    'Set both pulleys at the bottom and hold a handle in each hand, palms facing forward.',
    'With a slight bend in your elbows, sweep your hands up and together to chin height.',
    'Lower back to the start under control.',
  ]],
  ['High-to-Low Cable Fly', 'cable', 'isolation', ['chest'], ['shoulders'], [
    'Set both pulleys high, take a handle in each hand and step forward into a split stance.',
    'With a slight bend in your elbows, bring your hands down and together in front of your hips.',
    'Return slowly until you feel a stretch across your chest.',
  ]],
  ['Dumbbell Squeeze Press', 'dumbbell', 'compound', ['chest'], ['triceps'], [
    'Lie on a flat bench and press two dumbbells together over your chest, palms facing each other.',
    'Keep squeezing them together as you lower them to your chest.',
    'Press back up while keeping the dumbbells touching.',
  ]],
  ['Assisted Dip', 'machine', 'compound', ['triceps'], ['chest', 'shoulders'], [
    'Set the assistance weight, kneel or stand on the platform and grip the dip handles.',
    'Lower yourself until your elbows are bent to about 90 degrees, leaning slightly forward.',
    'Press back up to straight arms. More assistance weight makes it easier.',
  ]],
  // Back
  ['Assisted Pull-Up', 'machine', 'compound', ['lats'], ['biceps', 'middle back'], [
    'Set the assistance weight, kneel or stand on the platform and grip the bar a little wider than your shoulders.',
    'Pull yourself up until your chin clears the bar, driving your elbows down.',
    'Lower all the way down with control. More assistance weight makes it easier.',
  ]],
  ['Neutral-Grip Lat Pulldown', 'cable', 'compound', ['lats'], ['biceps', 'middle back'], [
    'Attach a close neutral-grip handle and sit with your thighs under the pads.',
    'Pull the handle to your upper chest, leaning back slightly and driving your elbows down.',
    'Let it rise slowly until your arms are straight.',
  ]],
  ['Single-Arm Cable Row', 'cable', 'compound', ['middle back'], ['lats', 'biceps'], [
    'Attach a single handle to a low or mid pulley and sit or stand facing it.',
    'Row the handle to your side, keeping your elbow close and your torso still.',
    'Reach forward slowly for a stretch. Finish all reps, then switch arms.',
  ]],
  ['Chest-Supported Machine Row', 'machine', 'compound', ['middle back'], ['lats', 'biceps', 'shoulders'], [
    'Set the seat so the pad supports your chest and you can just reach the handles.',
    'Pull the handles back, squeezing your shoulder blades together.',
    'Return slowly until your arms are straight.',
  ]],
  ['T-Bar Row', 'barbell', 'compound', ['middle back'], ['lats', 'biceps', 'lower back'], [
    'Straddle a landmine or T-bar row machine and grab the handles with your back flat and hips hinged.',
    'Row the weight to your chest, squeezing your shoulder blades.',
    'Lower until your arms are straight without rounding your back.',
  ]],
  ['Pendlay Row', 'barbell', 'compound', ['middle back'], ['lats', 'biceps', 'lower back'], [
    'Hinge until your torso is close to parallel with the floor, the bar resting on the ground.',
    'Pull the bar explosively to your lower chest.',
    'Lower it back to the floor and reset before each rep.',
  ]],
  ['Seal Row', 'barbell', 'compound', ['middle back'], ['lats', 'biceps'], [
    'Lie face down on a raised bench with the bar or dumbbells hanging below you.',
    'Row the weight up until it touches the bench, keeping your chest on the pad.',
    'Lower all the way down for a full stretch.',
  ]],
  ['Meadows Row', 'barbell', 'compound', ['middle back'], ['lats', 'biceps'], [
    'Stand side-on to a landmine bar, stagger your stance and grab the end of the bar with an overhand grip.',
    'Row the bar up and back toward your hip, keeping your torso still.',
    'Lower with control. Finish all reps, then switch sides.',
  ]],
  ['Kroc Row', 'dumbbell', 'compound', ['middle back'], ['lats', 'biceps', 'forearms'], [
    'Brace one hand on a bench and hold a heavy dumbbell in the other.',
    'Row it hard to your hip, allowing a little body movement, for high reps.',
    'Lower all the way down each rep. Switch arms when done.',
  ]],
  // Shoulders
  ['Machine Lateral Raise', 'machine', 'isolation', ['shoulders'], [], [
    'Sit with the pads against the outside of your upper arms.',
    'Raise your arms out to the sides until they reach shoulder height.',
    'Lower slowly.',
  ]],
  ['Single-Arm Cable Lateral Raise', 'cable', 'isolation', ['shoulders'], [], [
    'Stand side-on to a low pulley and take the handle in your far hand.',
    'Raise your arm out to the side to shoulder height with a slight bend in the elbow.',
    'Lower slowly. Finish all reps, then switch arms.',
  ]],
  ['Cable Y Raise', 'cable', 'isolation', ['shoulders'], ['traps'], [
    'Set both pulleys low and cross the cables, holding the left handle in your right hand and vice versa.',
    'Raise your arms up and out into a Y shape, thumbs up.',
    'Lower under control.',
  ]],
  ['Landmine Press', 'barbell', 'compound', ['shoulders'], ['chest', 'triceps'], [
    'Hold the end of a landmine bar at shoulder height in one hand, staggered stance.',
    'Press the bar up and forward until your arm is straight.',
    'Lower back to your shoulder. Finish all reps, then switch sides.',
  ]],
  ['Z Press', 'barbell', 'compound', ['shoulders'], ['triceps', 'abdominals'], [
    'Sit on the floor with your legs straight out and the bar racked at shoulder height.',
    'Press the bar overhead without leaning back.',
    'Lower it back to your upper chest.',
  ]],
  ['Landmine Squat to Press', 'barbell', 'compound', ['quadriceps'], ['shoulders', 'glutes', 'triceps'], [
    'Hold the end of a landmine bar with both hands at your chest, feet shoulder-width apart.',
    'Squat down, keeping your chest up and the bar close.',
    'Drive up out of the squat and use that momentum to press the bar up and forward until your arms are straight.',
    'Lower the bar back to your chest and go straight into the next squat.',
  ]],
  ['Landmine Squat', 'barbell', 'compound', ['quadriceps'], ['glutes'], [
    'Hold the end of a landmine bar at your chest with both hands, feet shoulder-width apart.',
    'Squat down between your knees, keeping your torso upright.',
    'Stand back up by driving through your feet.',
  ]],
  // Arms
  ['Bayesian Cable Curl', 'cable', 'isolation', ['biceps'], [], [
    'Stand facing away from a low pulley holding the handle behind you, arm stretched back.',
    'Curl the handle forward and up while keeping your elbow back.',
    'Lower slowly into the stretch. Finish all reps, then switch arms.',
  ]],
  ['Cable Triceps Kickback', 'cable', 'isolation', ['triceps'], [], [
    'Hinge forward next to a low pulley and hold the cable with your upper arm tucked by your side.',
    'Straighten your elbow until your arm points straight back.',
    'Return slowly without moving your upper arm.',
  ]],
  ['Single-Arm Cable Pushdown', 'cable', 'isolation', ['triceps'], [], [
    'Attach a single handle to a high pulley and keep your elbow tight to your side.',
    'Push the handle down until your arm is straight.',
    'Let it rise slowly to about 90 degrees. Finish all reps, then switch arms.',
  ]],
  // Core
  ["Captain's Chair Knee Raise", 'body only', 'isolation', ['abdominals'], [], [
    'Support yourself on the forearm pads of the captain\'s chair with your back against the pad.',
    'Lift your knees toward your chest, curling your pelvis up.',
    'Lower slowly without swinging.',
  ]],
  ['Hanging Knee Raise', 'body only', 'isolation', ['abdominals'], [], [
    'Hang from a pull-up bar with straight arms.',
    'Bring your knees up toward your chest, tilting your pelvis.',
    'Lower slowly without swinging.',
  ]],
  ['Hollow Body Hold', 'body only', 'isolation', ['abdominals'], [], [
    'Lie on your back with arms overhead and legs straight.',
    'Press your lower back into the floor and lift your shoulders and legs a few inches.',
    'Hold the position while breathing steadily.',
  ]],
  ['Bird Dog', 'body only', 'isolation', ['lower back'], ['abdominals', 'glutes'], [
    'Start on hands and knees with a flat back.',
    'Extend one arm forward and the opposite leg back until both are level with your body.',
    'Pause, return, and switch sides.',
  ]],
  ['Decline Sit-Up', 'body only', 'isolation', ['abdominals'], [], [
    'Lie on a decline bench with your feet hooked under the pads.',
    'Curl up until your torso is upright.',
    'Lower slowly back down.',
  ]],
  ['Copenhagen Plank', 'body only', 'isolation', ['adductors'], ['abdominals'], [
    'Lie on your side with your top leg resting on a bench and your forearm on the floor.',
    'Lift your hips so your body is in a straight line, held up by your top leg.',
    'Hold, then switch sides.',
  ]],
  ['Suitcase Carry', 'dumbbell', 'compound', ['abdominals'], ['forearms', 'traps'], [
    'Pick up a heavy dumbbell or kettlebell in one hand.',
    'Walk with it at your side, staying tall without leaning toward the weight.',
    'Switch hands and repeat.',
  ]],
  // Conditioning
  ['Burpee', 'body only', 'compound', ['quadriceps'], ['chest', 'shoulders', 'abdominals'], [
    'From standing, squat down and place your hands on the floor.',
    'Jump your feet back to a push-up position, do a push-up if you like, then jump your feet back in.',
    'Jump up with your arms overhead.',
  ], 'cardio'],
  ['Ski Erg', 'machine', 'compound', ['lats'], ['triceps', 'abdominals'], [
    'Stand facing the machine holding both handles overhead.',
    'Pull the handles down to your thighs, hinging at the hips.',
    'Return to the top and repeat at a steady rhythm.',
  ], 'cardio'],
  ['Incline Treadmill Walk', 'machine', 'compound', ['glutes'], ['calves', 'hamstrings'], [
    'Set the treadmill to a steep incline and a brisk walking pace.',
    'Walk without holding the rails, standing tall.',
  ], 'cardio'],
  ['Jumping Jacks', 'body only', 'compound', ['calves'], ['shoulders'], [
    'Stand with your feet together and arms at your sides.',
    'Jump your feet out while raising your arms overhead.',
    'Jump back to the start and repeat quickly.',
  ], 'cardio'],
];

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const EXTRA_EXERCISES: Exercise[] = ROWS.map(([name, equipment, mechanic, primaryMuscles, secondaryMuscles, instructions, category]) => ({
  id: `x_${slug(name)}`,
  name,
  category: category ?? 'strength',
  equipment,
  level: 'intermediate',
  mechanic,
  primaryMuscles,
  secondaryMuscles,
  instructions,
  images: [],
}));

/** Everyday gym names for library exercises whose official names are different. Keys are exercise ids. */
export const ALIASES: Record<string, string[]> = {
  Butterfly: ['pec deck', 'chest fly machine'],
  Reverse_Machine_Flyes: ['reverse pec deck', 'rear delt machine'],
  Thigh_Abductor: ['hip abduction', 'abductor machine'],
  Thigh_Adductor: ['hip adduction', 'adductor machine'],
  Leverage_Chest_Press: ['chest press machine', 'machine chest press'],
  Leverage_Incline_Chest_Press: ['incline chest press machine', 'incline machine press'],
  Leverage_Shoulder_Press: ['shoulder press machine', 'machine shoulder press'],
  Leverage_Iso_Row: ['machine row', 'iso row'],
  Leverage_High_Row: ['high row machine'],
  Romanian_Deadlift: ['rdl'],
  'Stiff-Legged_Dumbbell_Deadlift': ['dumbbell rdl'],
  Standing_Military_Press: ['ohp', 'overhead press', 'barbell shoulder press'],
  Seated_Dumbbell_Press: ['seated dumbbell shoulder press'],
  Tricep_Dumbbell_Kickback: ['triceps kickback', 'dumbbell kickback'],
  Standing_Dumbbell_Triceps_Extension: ['dumbbell overhead triceps extension', 'overhead dumbbell extension'],
  'Push-Ups_-_Close_Triceps_Position': ['diamond push up', 'close grip push up'],
  Dip_Machine: ['triceps dip machine', 'seated dip machine'],
  Dumbbell_Incline_Row: ['chest supported row', 'chest supported dumbbell row'],
  'One-Legged_Cable_Kickback': ['cable glute kickback', 'cable kickback'],
  Pull_Through: ['cable pull through'],
  Hyperextensions_Back_Extensions: ['back extension', '45 degree hyperextension', 'roman chair'],
  Calf_Press_On_The_Leg_Press_Machine: ['leg press calf raise'],
  Standing_Calf_Raises: ['standing calf raise machine'],
  Ab_Roller: ['ab wheel', 'ab wheel rollout'],
  Standing_Cable_Wood_Chop: ['woodchopper', 'cable chop'],
  Landmine_180s: ['landmine rotation', 'landmine twist'],
  Battling_Ropes: ['battle ropes'],
  Rowing_Stationary: ['rowing machine', 'rower', 'erg'],
  Bicycling_Stationary: ['stationary bike', 'exercise bike', 'spin bike'],
  Stairmaster: ['stair climber', 'stair machine'],
  Rope_Jumping: ['jump rope', 'skipping'],
  Air_Bike: ['assault bike', 'fan bike'],
  Goblet_Squat: ['kettlebell goblet squat'],
  'EZ-Bar_Skullcrusher': ['skull crusher', 'lying triceps extension'],
  'Triceps_Pushdown_-_Rope_Attachment': ['rope pushdown'],
  Ab_Crunch_Machine: ['machine crunch'],
  'Straight-Arm_Pulldown': ['lat prayer'],
  'Band_Assisted_Pull-Up': ['band pull up'],
};
