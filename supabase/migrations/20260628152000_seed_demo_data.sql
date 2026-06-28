-- Demo seed data for MVP testing (idempotent).
-- Safe to re-run: skips rows that already exist by name/item.

INSERT INTO sources (name, type, confidence)
SELECT 'Reporte Voluntario', 'ngo', 'low'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE name = 'Reporte Voluntario');

INSERT INTO hospitals (name, address, phone, capacity, current_occ, status, notes)
SELECT 'Hospital Universitario de Caracas', 'Av. Paseo Los Ilustres, Caracas', '0212-605-9111', 450, 380, 'active', 'Atención de emergencia activa'
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = 'Hospital Universitario de Caracas');

INSERT INTO hospitals (name, address, phone, capacity, current_occ, status, notes)
SELECT 'Hospital Miguel Pérez Carreño', 'Av. San Martín, Caracas', '0212-862-3131', 320, 290, 'active', 'Alta demanda de traumatología'
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = 'Hospital Miguel Pérez Carreño');

INSERT INTO hospitals (name, address, phone, capacity, current_occ, status, notes)
SELECT 'Hospital Dr. Domingo Luciani', 'Av. Los Samanes, Los Palos Grandes', '0212-276-1000', 280, 210, 'active', 'Recibiendo pacientes trasladados'
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = 'Hospital Dr. Domingo Luciani');

INSERT INTO shelters (name, address, capacity, current_occ, contact_name, contact_phone, status, notes)
SELECT
  'Parque del Este - Centro de Damnificados',
  'Parque del Este, Caracas',
  800,
  620,
  'Coordinación voluntarios',
  '0414-000-0000',
  'active',
  'Alta concentración de familias con niños'
WHERE NOT EXISTS (SELECT 1 FROM shelters WHERE name = 'Parque del Este - Centro de Damnificados');

INSERT INTO shelters (name, address, capacity, current_occ, contact_name, contact_phone, status, notes)
SELECT
  'Polideportivo El Poliedro',
  'Autopista Francisco Fajardo, Caracas',
  1200,
  480,
  'Protección Civil',
  '0424-000-0000',
  'active',
  'Capacidad disponible para recibir más personas'
WHERE NOT EXISTS (SELECT 1 FROM shelters WHERE name = 'Polideportivo El Poliedro');

INSERT INTO shelters (name, address, capacity, current_occ, contact_name, contact_phone, status, notes)
SELECT
  'Universidad Metropolitana - Refugio temporal',
  'Calle Aranda, Bellas Artes, Caracas',
  350,
  310,
  'Equipo universitario',
  '0412-000-0000',
  'active',
  'Prioridad en insumos para bebés'
WHERE NOT EXISTS (SELECT 1 FROM shelters WHERE name = 'Universidad Metropolitana - Refugio temporal');

INSERT INTO supply_centers (name, address, schedule, accepts, not_accepts, contact_phone, status, notes)
SELECT
  'Centro de Acopio Plaza Venezuela',
  'Plaza Venezuela, Caracas',
  '08:00 - 20:00',
  ARRAY['cobijas', 'sábanas', 'pañales', 'toallas higiénicas', 'medicamentos básicos'],
  ARRAY['comida cocinada', 'ropa usada sin empaque'],
  '0416-000-0000',
  'active',
  'Recepción organizada por tipo de insumo'
WHERE NOT EXISTS (SELECT 1 FROM supply_centers WHERE name = 'Centro de Acopio Plaza Venezuela');

INSERT INTO supply_centers (name, address, schedule, accepts, not_accepts, contact_phone, status, notes)
SELECT
  'Centro de Acopio Chacao',
  'Av. Francisco de Miranda, Chacao',
  '09:00 - 18:00',
  ARRAY['leche en polvo', 'cunas', 'pañales', 'agua embotellada'],
  ARRAY['medicamentos vencidos', 'comida perecedera'],
  '0426-000-0000',
  'active',
  'Enfoque en insumos pediátricos'
WHERE NOT EXISTS (SELECT 1 FROM supply_centers WHERE name = 'Centro de Acopio Chacao');

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'shelter', s.id, 'Pañales talla M', 'critical', 500, 120, 'unidades', 'Urgente para bebés en refugio'
FROM shelters s
WHERE s.name = 'Parque del Este - Centro de Damnificados'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = s.id AND n.item_name = 'Pañales talla M'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'shelter', s.id, 'Cunas portátiles', 'critical', 40, 8, 'unidades', 'Familias durmiendo en el piso'
FROM shelters s
WHERE s.name = 'Parque del Este - Centro de Damnificados'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = s.id AND n.item_name = 'Cunas portátiles'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'shelter', s.id, 'Cobijas', 'high', 300, 180, 'unidades', 'Noche fría en áreas abiertas'
FROM shelters s
WHERE s.name = 'Parque del Este - Centro de Damnificados'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = s.id AND n.item_name = 'Cobijas'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'shelter', s.id, 'Leche en polvo etapa 1', 'high', 200, 95, 'latas', 'Bebés menores de 6 meses'
FROM shelters s
WHERE s.name = 'Universidad Metropolitana - Refugio temporal'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = s.id AND n.item_name = 'Leche en polvo etapa 1'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'hospital', h.id, 'Diclofenac 75mg', 'critical', 100, 0, 'ampollas', 'Stock agotado según reporte de turno'
FROM hospitals h
WHERE h.name = 'Hospital Miguel Pérez Carreño'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = h.id AND n.item_name = 'Diclofenac 75mg'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'hospital', h.id, 'Suero fisiológico 500ml', 'high', 400, 260, 'bolsas', 'Reposición continua'
FROM hospitals h
WHERE h.name = 'Hospital Universitario de Caracas'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = h.id AND n.item_name = 'Suero fisiológico 500ml'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'hospital', h.id, 'Sábanas hospitalarias', 'medium', 150, 110, 'unidades', 'Rotación alta de camas'
FROM hospitals h
WHERE h.name = 'Hospital Dr. Domingo Luciani'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = h.id AND n.item_name = 'Sábanas hospitalarias'
  );

INSERT INTO needs (needable_type, needable_id, item_name, priority, qty_required, qty_received, unit, notes)
SELECT 'shelter', s.id, 'Toallas higiénicas', 'medium', 250, 200, 'paquetes', 'Ya cubierto en parte, sigue faltando'
FROM shelters s
WHERE s.name = 'Polideportivo El Poliedro'
  AND NOT EXISTS (
    SELECT 1 FROM needs n
    WHERE n.needable_id = s.id AND n.item_name = 'Toallas higiénicas'
  );

INSERT INTO persons (first_name, last_name, status, hospital_id, confidence, source_id, notes, reported_at)
SELECT
  'María',
  'García',
  'injured',
  h.id,
  'high',
  src.id,
  'Paciente estable, en observación',
  now() - interval '2 hours'
FROM hospitals h
CROSS JOIN sources src
WHERE h.name = 'Hospital Universitario de Caracas'
  AND src.name = 'Cruz Roja'
  AND NOT EXISTS (
    SELECT 1 FROM persons p
    WHERE p.first_name = 'María' AND p.last_name = 'García' AND p.deleted_at IS NULL
  );

INSERT INTO persons (first_name, last_name, status, hospital_id, confidence, source_id, notes, reported_at)
SELECT
  'Juan',
  'Pérez',
  'transferred',
  h.id,
  'high',
  src.id,
  'Trasladado desde refugio temporal',
  now() - interval '4 hours'
FROM hospitals h
CROSS JOIN sources src
WHERE h.name = 'Hospital Miguel Pérez Carreño'
  AND src.name = 'Proteccion Civil'
  AND NOT EXISTS (
    SELECT 1 FROM persons p
    WHERE p.first_name = 'Juan' AND p.last_name = 'Pérez' AND p.deleted_at IS NULL
  );

INSERT INTO persons (first_name, last_name, status, shelter_id, confidence, source_id, notes, reported_at)
SELECT
  'Ana',
  'Rodríguez',
  'safe',
  s.id,
  'medium',
  src.id,
  'Acompañada por familiar en refugio',
  now() - interval '1 hour'
FROM shelters s
CROSS JOIN sources src
WHERE s.name = 'Parque del Este - Centro de Damnificados'
  AND src.name = 'Reporte Voluntario'
  AND NOT EXISTS (
    SELECT 1 FROM persons p
    WHERE p.first_name = 'Ana' AND p.last_name = 'Rodríguez' AND p.deleted_at IS NULL
  );

INSERT INTO persons (first_name, last_name, status, shelter_id, confidence, source_id, notes, reported_at)
SELECT
  'Carlos',
  'Mendoza',
  'unknown',
  s.id,
  'low',
  src.id,
  'Registro parcial, pendiente confirmación',
  now() - interval '30 minutes'
FROM shelters s
CROSS JOIN sources src
WHERE s.name = 'Polideportivo El Poliedro'
  AND src.name = 'Reporte Voluntario'
  AND NOT EXISTS (
    SELECT 1 FROM persons p
    WHERE p.first_name = 'Carlos' AND p.last_name = 'Mendoza' AND p.deleted_at IS NULL
  );

INSERT INTO persons (first_name, last_name, status, hospital_id, confidence, source_id, notes, reported_at)
SELECT
  'Luis',
  'Fernández',
  'injured',
  h.id,
  'high',
  src.id,
  'Fractura menor, evolución favorable',
  now() - interval '6 hours'
FROM hospitals h
CROSS JOIN sources src
WHERE h.name = 'Hospital Dr. Domingo Luciani'
  AND src.name = 'Secretaria de Salud'
  AND NOT EXISTS (
    SELECT 1 FROM persons p
    WHERE p.first_name = 'Luis' AND p.last_name = 'Fernández' AND p.deleted_at IS NULL
  );
