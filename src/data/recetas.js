// Recetario propio. Los valores son aproximados por 100 g, con los alimentos ya cocidos.
export const INGREDIENTES = {
  pollo: { nombre: "Pechuga de pollo cocida", kcal: 165, p: 31, c: 0, g: 3.6 },
  milanesa_pollo: { nombre: "Milanesa de pollo al horno", kcal: 220, p: 22, c: 14, g: 8 },
  carne_magra: { nombre: "Bife magro a la plancha", kcal: 200, p: 27, c: 0, g: 10 },
  carne_picada: { nombre: "Carne picada magra cocida", kcal: 210, p: 26, c: 0, g: 11 },
  cerdo: { nombre: "Bondiola o solomillo de cerdo cocido", kcal: 215, p: 27, c: 0, g: 11 },
  merluza: { nombre: "Merluza al horno", kcal: 90, p: 18, c: 0, g: 1.5 },
  salmon: { nombre: "Salmón cocido", kcal: 208, p: 20, c: 0, g: 13 },
  atun: { nombre: "Atún al natural", kcal: 116, p: 26, c: 0, g: 1 },
  huevo: { nombre: "Huevo", kcal: 143, p: 12.6, c: 0.7, g: 9.5, unidad: ["huevo", 50] },
  jamon: { nombre: "Jamón cocido magro", kcal: 110, p: 18, c: 1.5, g: 3.5 },
  queso: { nombre: "Queso cremoso", kcal: 300, p: 20, c: 2, g: 24 },
  yogur: { nombre: "Yogur descremado", kcal: 45, p: 4, c: 6, g: 0.1 },
  leche: { nombre: "Leche descremada", kcal: 36, p: 3.3, c: 5, g: 0.1 },
  proteina_polvo: { nombre: "Proteína en polvo", kcal: 390, p: 75, c: 10, g: 5 },
  lentejas: { nombre: "Lentejas cocidas", kcal: 116, p: 9, c: 20, g: 0.4 },
  garbanzos: { nombre: "Garbanzos cocidos", kcal: 164, p: 8.9, c: 27, g: 2.6 },
  arroz: { nombre: "Arroz cocido", kcal: 130, p: 2.7, c: 28, g: 0.3 },
  fideos: { nombre: "Fideos cocidos", kcal: 155, p: 5.5, c: 30, g: 1 },
  papa: { nombre: "Papa al horno o hervida", kcal: 87, p: 1.9, c: 20, g: 0.1 },
  batata: { nombre: "Batata al horno", kcal: 90, p: 1.6, c: 21, g: 0.1 },
  pure: { nombre: "Puré de papas", kcal: 110, p: 2, c: 16, g: 4 },
  pan: { nombre: "Pan integral", kcal: 250, p: 9, c: 45, g: 3.5 },
  rapidita: { nombre: "Rapidita o tortilla de trigo", kcal: 290, p: 8, c: 48, g: 7 },
  avena: { nombre: "Avena", kcal: 380, p: 13, c: 66, g: 7 },
  granola: { nombre: "Granola", kcal: 450, p: 10, c: 65, g: 15 },
  banana: { nombre: "Banana", kcal: 89, p: 1.1, c: 22.8, g: 0.3 },
  manzana: { nombre: "Manzana", kcal: 52, p: 0.3, c: 14, g: 0.2 },
  verduras: { nombre: "Verduras salteadas", kcal: 45, p: 2, c: 8, g: 0.3 },
  ensalada: { nombre: "Ensalada de hojas y tomate", kcal: 22, p: 1, c: 4, g: 0.2 },
  salsa_tomate: { nombre: "Salsa de tomate", kcal: 40, p: 1.5, c: 8, g: 0.3 },
  palta: { nombre: "Palta", kcal: 160, p: 2, c: 8.5, g: 15 },
  aceite: { nombre: "Aceite de oliva", kcal: 884, p: 0, c: 0, g: 100 },
  mani: { nombre: "Maní tostado", kcal: 590, p: 25, c: 16, g: 50 },
  mantequilla_mani: { nombre: "Pasta de maní", kcal: 600, p: 25, c: 20, g: 50 },
  clara: { nombre: "Clara de huevo", kcal: 52, p: 11, c: 0.7, g: 0.2, unidad: ["clara", 33] },
  frutilla: { nombre: "Frutillas", kcal: 32, p: 0.7, c: 7.7, g: 0.3 },
  zapallito: { nombre: "Zapallitos y zanahoria", kcal: 25, p: 1.2, c: 5, g: 0.2 },
  crema: { nombre: "Crema de leche", kcal: 340, p: 2, c: 3, g: 35 },
  dulce_leche: { nombre: "Dulce de leche", kcal: 315, p: 7, c: 55, g: 7.5 },
};

// Cada parte con rol se ajusta a lo que falta dentro de un rango razonable. Las que tienen g quedan fijas.
export const RECETAS = [
  {
    id: "pollo-arroz", nombre: "Pollo con arroz y verduras salteadas", tipos: ["almuerzo", "cena"], minutos: 20, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 100, max: 260 }, { ing: "arroz", rol: "carbo", min: 80, max: 350 }, { ing: "verduras", g: 150 }, { ing: "aceite", rol: "grasa", min: 3, max: 15, paso: 1 }],
    pasos: ["Cociná el arroz.", "Dorá el pollo en cubos con un poco de aceite.", "Sumá las verduras, saltealas 5 minutos y mezclá con el arroz."],
  },
  {
    id: "milanesa-pure", nombre: "Milanesa de pollo al horno con puré", tipos: ["almuerzo", "cena"], minutos: 30, base: "pollo",
    partes: [{ ing: "milanesa_pollo", rol: "proteina", min: 120, max: 280 }, { ing: "pure", rol: "carbo", min: 100, max: 350 }, { ing: "ensalada", g: 120 }],
    pasos: ["Hacé las milanesas al horno fuerte, 10 minutos de cada lado.", "Prepará el puré.", "Serví con una ensalada simple."],
  },
  {
    id: "bife-papas", nombre: "Bife a la plancha con papas al horno y ensalada", tipos: ["almuerzo", "cena"], minutos: 35, base: "carne",
    partes: [{ ing: "carne_magra", rol: "proteina", min: 120, max: 280 }, { ing: "papa", rol: "carbo", min: 120, max: 450 }, { ing: "ensalada", g: 120 }],
    pasos: ["Cortá las papas y hornealas 25 minutos con sal y pimentón.", "Hacé el bife en una plancha bien caliente.", "Serví con la ensalada."],
  },
  {
    id: "carne-arroz", nombre: "Arroz con carne picada y morrón", tipos: ["almuerzo", "cena"], minutos: 25, base: "carne",
    partes: [{ ing: "carne_picada", rol: "proteina", min: 100, max: 260 }, { ing: "arroz", rol: "carbo", min: 80, max: 350 }, { ing: "verduras", g: 120 }],
    pasos: ["Rehogá cebolla y morrón.", "Sumá la carne y cociná hasta dorar.", "Mezclá con el arroz cocido y condimentá."],
  },
  {
    id: "fideos-pollo", nombre: "Fideos con pollo y salsa de tomate", tipos: ["almuerzo", "cena"], minutos: 20, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 90, max: 240 }, { ing: "fideos", rol: "carbo", min: 100, max: 350 }, { ing: "salsa_tomate", g: 120 }],
    pasos: ["Hervi los fideos.", "Dorá el pollo en tiras y sumá la salsa.", "Mezclá todo y serví."],
  },
  {
    id: "atun-fideos", nombre: "Fideos con atún y tomate", tipos: ["almuerzo", "cena"], minutos: 15, base: "pescado",
    partes: [{ ing: "atun", rol: "proteina", min: 80, max: 240 }, { ing: "fideos", rol: "carbo", min: 100, max: 350 }, { ing: "salsa_tomate", g: 100 }, { ing: "aceite", rol: "grasa", min: 3, max: 15, paso: 1 }],
    pasos: ["Hervi los fideos.", "Calentá la salsa con el atún escurrido.", "Mezclá y terminá con un hilo de aceite."],
  },
  {
    id: "merluza-batata", nombre: "Merluza al horno con batata", tipos: ["almuerzo", "cena"], minutos: 30, base: "pescado",
    partes: [{ ing: "merluza", rol: "proteina", min: 150, max: 350 }, { ing: "batata", rol: "carbo", min: 120, max: 400 }, { ing: "ensalada", g: 100 }, { ing: "aceite", rol: "grasa", min: 3, max: 15, paso: 1 }],
    pasos: ["Horneá la batata en rodajas 20 minutos.", "Sumá la merluza con limón y sal.", "Cociná 10 minutos más."],
  },
  {
    id: "salmon-papa", nombre: "Salmón con papas y ensalada", tipos: ["almuerzo", "cena"], minutos: 25, base: "pescado",
    partes: [{ ing: "salmon", rol: "proteina", min: 110, max: 220 }, { ing: "papa", rol: "carbo", min: 120, max: 400 }, { ing: "ensalada", g: 120 }],
    pasos: ["Hervi las papas.", "Cociná el salmón en sartén, primero del lado de la piel.", "Serví con ensalada y limón."],
  },
  {
    id: "cerdo-batata", nombre: "Cerdo al horno con batatas", tipos: ["almuerzo", "cena"], minutos: 40, base: "cerdo",
    partes: [{ ing: "cerdo", rol: "proteina", min: 120, max: 250 }, { ing: "batata", rol: "carbo", min: 120, max: 400 }, { ing: "ensalada", g: 100 }],
    pasos: ["Condimentá el cerdo con mostaza y miel.", "Horneá con las batatas 35 minutos.", "Dejá reposar y serví."],
  },
  {
    id: "lentejas-arroz", nombre: "Lentejas guisadas con arroz", tipos: ["almuerzo", "cena"], minutos: 25, base: "legumbres",
    partes: [{ ing: "lentejas", rol: "proteina", min: 150, max: 400 }, { ing: "arroz", rol: "carbo", min: 60, max: 250 }, { ing: "salsa_tomate", g: 100 }, { ing: "verduras", g: 100 }],
    pasos: ["Rehogá las verduras.", "Sumá la salsa y las lentejas cocidas.", "Cociná 10 minutos y serví con arroz."],
  },
  {
    id: "wrap-pollo", nombre: "Wraps de pollo y palta", tipos: ["almuerzo", "cena"], minutos: 15, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 90, max: 220 }, { ing: "rapidita", rol: "carbo", min: 60, max: 180 }, { ing: "palta", rol: "grasa", min: 20, max: 100 }, { ing: "ensalada", g: 80 }],
    pasos: ["Dorá el pollo en tiras.", "Calentá las rapiditas.", "Armá con palta, ensalada y pollo."],
  },
  {
    id: "hamburguesa", nombre: "Hamburguesas caseras con pan y ensalada", tipos: ["almuerzo", "cena"], minutos: 20, base: "carne",
    partes: [{ ing: "carne_picada", rol: "proteina", min: 110, max: 260 }, { ing: "pan", rol: "carbo", min: 70, max: 170 }, { ing: "ensalada", g: 120 }],
    pasos: ["Formá medallones con la carne, sal y pimienta.", "Cocinalos a la plancha.", "Armá con pan, lechuga y tomate."],
  },
  {
    id: "ensalada-pollo", nombre: "Ensalada de pollo, garbanzos y huevo", tipos: ["almuerzo", "cena"], minutos: 15, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 80, max: 220 }, { ing: "garbanzos", rol: "carbo", min: 60, max: 250 }, { ing: "huevo", g: 50 }, { ing: "ensalada", g: 180 }, { ing: "aceite", rol: "grasa", min: 3, max: 15, paso: 1 }],
    pasos: ["Hervi el huevo.", "Cortá el pollo cocido.", "Mezclá todo con la ensalada, aceite y limón."],
  },
  {
    id: "tortilla-verduras", nombre: "Tortilla de papa y verduras al horno", tipos: ["almuerzo", "cena"], minutos: 30, base: "huevo",
    partes: [{ ing: "huevo", rol: "proteina", min: 100, max: 250 }, { ing: "papa", rol: "carbo", min: 100, max: 350 }, { ing: "verduras", g: 120 }],
    pasos: ["Hervi y cortá las papas.", "Batí los huevos con las verduras.", "Horneá en una fuente 20 minutos."],
  },
  {
    id: "omelette", nombre: "Omelette de jamón y queso con tostadas", tipos: ["cena", "desayuno"], minutos: 10, base: "huevo",
    partes: [{ ing: "huevo", rol: "proteina", min: 100, max: 200 }, { ing: "jamon", g: 40 }, { ing: "queso", g: 25 }, { ing: "pan", rol: "carbo", min: 30, max: 130 }],
    pasos: ["Batí los huevos.", "Cociná en sartén con jamón y queso.", "Serví con tostadas."],
  },
  {
    id: "sopa-pollo", nombre: "Sopa de verduras con pollo", tipos: ["cena", "almuerzo"], minutos: 25, base: "pollo", liviana: true,
    partes: [{ ing: "pollo", rol: "proteina", min: 60, max: 180 }, { ing: "papa", rol: "carbo", min: 40, max: 200 }, { ing: "verduras", g: 200 }],
    pasos: ["Hervi las verduras con caldo casero.", "Sumá papa y pollo en cubos.", "Cociná 15 minutos."],
  },
  {
    id: "ensalada-atun", nombre: "Ensalada de atún y huevo", tipos: ["cena", "almuerzo"], minutos: 10, base: "pescado", liviana: true,
    partes: [{ ing: "atun", rol: "proteina", min: 60, max: 200 }, { ing: "huevo", g: 50 }, { ing: "ensalada", g: 200 }],
    pasos: ["Hervi el huevo.", "Escurrí el atún.", "Mezclá con la ensalada y limón."],
  },
  {
    id: "avena-banana", nombre: "Avena con banana y yogur", tipos: ["desayuno", "merienda", "colacion"], minutos: 5, base: "lacteo", dulce: true,
    partes: [{ ing: "yogur", rol: "proteina", min: 120, max: 350 }, { ing: "avena", rol: "carbo", min: 30, max: 100 }, { ing: "banana", g: 100 }],
    pasos: ["Mezclá la avena con el yogur.", "Sumá la banana en rodajas."],
  },
  {
    id: "licuado", nombre: "Licuado de banana con proteína", tipos: ["desayuno", "merienda", "colacion"], minutos: 5, base: "lacteo", dulce: true,
    partes: [{ ing: "proteina_polvo", rol: "proteina", min: 15, max: 45, paso: 5 }, { ing: "banana", rol: "carbo", min: 80, max: 200 }, { ing: "leche", g: 250 }],
    pasos: ["Poné todo en la licuadora.", "Licuá un minuto y serví frío."],
  },
  {
    id: "tostadas-huevo", nombre: "Tostadas con huevo revuelto y palta", tipos: ["desayuno", "merienda", "colacion"], minutos: 10, base: "huevo",
    partes: [{ ing: "huevo", rol: "proteina", min: 50, max: 150 }, { ing: "pan", rol: "carbo", min: 40, max: 120 }, { ing: "palta", rol: "grasa", min: 20, max: 80 }],
    pasos: ["Tostá el pan.", "Revolvé los huevos a fuego bajo.", "Armá las tostadas con palta."],
  },
  {
    id: "tostadas-jamon", nombre: "Tostadas con jamón y queso", tipos: ["desayuno", "merienda", "colacion"], minutos: 5, base: "lacteo",
    partes: [{ ing: "jamon", rol: "proteina", min: 40, max: 150 }, { ing: "pan", rol: "carbo", min: 40, max: 120 }, { ing: "queso", g: 25 }],
    pasos: ["Tostá el pan.", "Sumá jamón y queso, y calentá hasta que se derrita."],
  },
  {
    id: "yogur-granola", nombre: "Yogur con granola y manzana", tipos: ["desayuno", "merienda", "colacion"], minutos: 3, base: "lacteo", liviana: true, dulce: true,
    partes: [{ ing: "yogur", rol: "proteina", min: 120, max: 300 }, { ing: "granola", rol: "carbo", min: 15, max: 60, paso: 5 }, { ing: "manzana", g: 80 }],
    pasos: ["Serví el yogur en un bowl.", "Sumá la granola y la manzana."],
  },
  {
    id: "banana-mani", nombre: "Banana con pasta de maní", tipos: ["desayuno", "merienda", "colacion"], minutos: 2, base: "fruta", dulce: true,
    partes: [{ ing: "banana", rol: "carbo", min: 80, max: 200 }, { ing: "mantequilla_mani", rol: "grasa", min: 10, max: 35, paso: 5 }],
    pasos: ["Cortá la banana.", "Untala con la pasta de maní."],
  },
  {
    id: "fruta-yogur", nombre: "Manzana con yogur", tipos: ["desayuno", "merienda", "cena", "colacion"], minutos: 2, base: "fruta", liviana: true, dulce: true,
    partes: [{ ing: "yogur", rol: "proteina", min: 100, max: 200 }, { ing: "manzana", g: 120 }],
    pasos: ["Cortá la manzana.", "Serví con yogur."],
  },
  // Para definir: mucho volumen y pocas calorías.
  {
    id: "wok-pollo", nombre: "Wok de pollo con muchas verduras", tipos: ["almuerzo", "cena"], minutos: 20, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 100, max: 250 }, { ing: "verduras", g: 300 }, { ing: "arroz", rol: "carbo", min: 40, max: 200 }, { ing: "aceite", rol: "grasa", min: 3, max: 10, paso: 1 }],
    pasos: ["Cortá el pollo y las verduras en tiras.", "Saltealos a fuego fuerte con un chorrito de aceite y salsa de soja.", "Serví con un poco de arroz."],
  },
  {
    id: "merluza-ensalada", nombre: "Merluza al horno con ensalada grande", tipos: ["almuerzo", "cena"], minutos: 25, base: "pescado",
    partes: [{ ing: "merluza", rol: "proteina", min: 150, max: 350 }, { ing: "ensalada", g: 250 }, { ing: "papa", rol: "carbo", min: 50, max: 250 }],
    pasos: ["Horneá la merluza con limón 15 minutos.", "Hervi las papas.", "Serví con una ensalada bien grande."],
  },
  {
    id: "omelette-claras", nombre: "Omelette de claras con verduras", tipos: ["desayuno", "cena", "colacion"], minutos: 10, base: "huevo", liviana: true,
    partes: [{ ing: "clara", rol: "proteina", min: 99, max: 297, paso: 33 }, { ing: "huevo", g: 50 }, { ing: "zapallito", g: 200 }, { ing: "pan", rol: "carbo", min: 20, max: 80 }],
    pasos: ["Saltea las verduras picadas.", "Sumá las claras batidas con el huevo.", "Cociná tapado y serví con una tostada."],
  },
  {
    id: "yogur-frutillas", nombre: "Bowl de yogur con frutillas", tipos: ["desayuno", "merienda", "colacion"], minutos: 3, base: "lacteo", liviana: true, dulce: true,
    partes: [{ ing: "yogur", rol: "proteina", min: 150, max: 400 }, { ing: "frutilla", g: 200 }, { ing: "avena", rol: "carbo", min: 10, max: 40, paso: 5 }],
    pasos: ["Serví el yogur.", "Sumá las frutillas cortadas y la avena."],
  },
  // Para bulk: ricas y con calorías, fáciles de comer en cantidad.
  {
    id: "fideos-bolognesa", nombre: "Fideos a la bolognesa con queso", tipos: ["almuerzo", "cena"], minutos: 25, base: "carne",
    partes: [{ ing: "fideos", rol: "carbo", min: 150, max: 450 }, { ing: "carne_picada", rol: "proteina", min: 100, max: 250 }, { ing: "salsa_tomate", g: 150 }, { ing: "queso", rol: "grasa", min: 15, max: 60, paso: 5 }],
    pasos: ["Hervi los fideos.", "Dorá la carne y sumá la salsa 10 minutos.", "Serví con queso rallado o en cubos."],
  },
  {
    id: "bowl-carne-palta", nombre: "Bowl de arroz con carne, huevo y palta", tipos: ["almuerzo", "cena"], minutos: 20, base: "carne",
    partes: [{ ing: "arroz", rol: "carbo", min: 120, max: 400 }, { ing: "carne_magra", rol: "proteina", min: 100, max: 250 }, { ing: "huevo", g: 50 }, { ing: "palta", rol: "grasa", min: 30, max: 120, paso: 10 }],
    pasos: ["Cociná el arroz.", "Hacé la carne a la plancha y cortala en tiras.", "Armá el bowl con el huevo frito y la palta."],
  },
  {
    id: "pollo-crema", nombre: "Pollo a la crema con puré", tipos: ["almuerzo", "cena"], minutos: 25, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 120, max: 260 }, { ing: "pure", rol: "carbo", min: 150, max: 400 }, { ing: "crema", rol: "grasa", min: 20, max: 80, paso: 5 }],
    pasos: ["Dorá el pollo en cubos.", "Sumá la crema y cociná 5 minutos.", "Serví con el puré."],
  },
  {
    id: "tostadas-mani-banana", nombre: "Tostadas con pasta de maní y banana", tipos: ["desayuno", "merienda", "colacion"], minutos: 5, base: "fruta", dulce: true,
    partes: [{ ing: "pan", rol: "carbo", min: 50, max: 150 }, { ing: "mantequilla_mani", rol: "grasa", min: 15, max: 50, paso: 5 }, { ing: "banana", g: 100 }],
    pasos: ["Tostá el pan.", "Untá la pasta de maní.", "Sumá la banana en rodajas."],
  },
  {
    id: "licuado-bulk", nombre: "Licuado de leche, avena, banana y dulce de leche", tipos: ["desayuno", "merienda", "colacion"], minutos: 5, base: "lacteo", dulce: true,
    partes: [{ ing: "leche", g: 300 }, { ing: "avena", rol: "carbo", min: 30, max: 100, paso: 10 }, { ing: "banana", g: 120 }, { ing: "proteina_polvo", rol: "proteina", min: 15, max: 45, paso: 5 }, { ing: "dulce_leche", rol: "grasa", min: 10, max: 40, paso: 5 }],
    pasos: ["Poné todo en la licuadora.", "Licuá un minuto y tomalo frío."],
  },
  // Colaciones: para entre comidas o para la noche, después de cenar.
  {
    id: "huevos-duros", nombre: "Huevos duros con una tostada", tipos: ["colacion", "desayuno", "merienda"], minutos: 10, base: "huevo", liviana: true,
    partes: [{ ing: "huevo", rol: "proteina", min: 50, max: 200 }, { ing: "pan", rol: "carbo", min: 20, max: 60 }],
    pasos: ["Hervi los huevos 9 minutos.", "Pelalos y serví con una tostada."],
  },
  {
    id: "yogur-proteina", nombre: "Yogur con proteína y maní", tipos: ["colacion", "merienda", "desayuno"], minutos: 3, base: "lacteo", dulce: true,
    partes: [{ ing: "yogur", g: 200 }, { ing: "proteina_polvo", rol: "proteina", min: 10, max: 40, paso: 5 }, { ing: "mani", rol: "grasa", min: 5, max: 30, paso: 5 }],
    pasos: ["Mezclá el yogur con la proteína.", "Sumá el maní picado arriba."],
  },
  {
    id: "atun-tostadas", nombre: "Tostadas con atún", tipos: ["colacion", "merienda", "cena"], minutos: 5, base: "pescado",
    partes: [{ ing: "atun", rol: "proteina", min: 60, max: 170 }, { ing: "pan", rol: "carbo", min: 30, max: 100 }],
    pasos: ["Tostá el pan.", "Escurrí el atún y ponelo arriba con limón."],
  },
  {
    id: "sandwich-pollo", nombre: "Sándwich de pollo y queso", tipos: ["colacion", "almuerzo", "cena"], minutos: 10, base: "pollo",
    partes: [{ ing: "pollo", rol: "proteina", min: 60, max: 180 }, { ing: "pan", rol: "carbo", min: 50, max: 150 }, { ing: "queso", g: 20 }],
    pasos: ["Calentá el pollo en tiras.", "Armá el sándwich con el queso y tostalo."],
  },
];
