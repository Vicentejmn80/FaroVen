-- Limpieza de datos mock/demo para dejar entorno "nuevo".
-- Idempotente: solo borra si la tabla existe (tu proyecto puede no tener todas las migraciones aplicadas).

DO $$
BEGIN
  -- 1) Recursos de apoyo demo (tabla de moderation_and_support)
  IF to_regclass('public.support_resources') IS NOT NULL THEN
    DELETE FROM support_resources
    WHERE name IN (
      'Línea de Emergencias 911',
      'Red de Psicólogos Voluntarios',
      'Grupo de apoyo para familias',
      'Espacio recreativo para niños'
    );
  END IF;

  -- 2) Boletines demo
  IF to_regclass('public.bulletins') IS NOT NULL THEN
    DELETE FROM bulletins
    WHERE title IN (
      'Priorizar insumos pediátricos en refugios',
      'Hospital Miguel Pérez Carreño solicita antiinflamatorios',
      'Centro de Acopio Chacao ya no recibe perecederos',
      'Actualización de ocupación en refugios principales'
    );
  END IF;

  -- 3) Personas demo
  IF to_regclass('public.persons') IS NOT NULL THEN
    DELETE FROM persons
    WHERE (first_name, last_name) IN (
      ('María', 'García'),
      ('Juan', 'Pérez'),
      ('Ana', 'Rodríguez'),
      ('Carlos', 'Mendoza')
    );
  END IF;

  -- 4) Necesidades demo
  IF to_regclass('public.needs') IS NOT NULL THEN
    DELETE FROM needs
    WHERE item_name IN (
      'Pañales talla M',
      'Cunas portátiles',
      'Cobijas',
      'Leche en polvo etapa 1',
      'Diclofenac 75mg',
      'Suero fisiológico 500ml',
      'Sábanas hospitalarias',
      'Toallas higiénicas'
    );
  END IF;

  -- 5) Perfiles de coordinador ligados a sitios demo
  IF to_regclass('public.coordinator_profiles') IS NOT NULL THEN
    DELETE FROM coordinator_profiles
    WHERE site_id IN (
      SELECT id FROM hospitals WHERE name IN (
        'Hospital Universitario de Caracas',
        'Hospital Miguel Pérez Carreño',
        'Hospital Dr. Domingo Luciani'
      )
      UNION
      SELECT id FROM supply_centers WHERE name IN (
        'Centro de Acopio Plaza Venezuela',
        'Centro de Acopio Chacao'
      )
      UNION
      SELECT id FROM shelters WHERE name IN (
        'Parque del Este - Centro de Damnificados',
        'Polideportivo El Poliedro',
        'Universidad Metropolitana - Refugio temporal'
      )
    );
  END IF;

  IF to_regclass('public.hospitals') IS NOT NULL THEN
    DELETE FROM hospitals
    WHERE name IN (
      'Hospital Universitario de Caracas',
      'Hospital Miguel Pérez Carreño',
      'Hospital Dr. Domingo Luciani'
    );
  END IF;

  IF to_regclass('public.supply_centers') IS NOT NULL THEN
    DELETE FROM supply_centers
    WHERE name IN (
      'Centro de Acopio Plaza Venezuela',
      'Centro de Acopio Chacao'
    );
  END IF;

  IF to_regclass('public.shelters') IS NOT NULL THEN
    DELETE FROM shelters
    WHERE name IN (
      'Parque del Este - Centro de Damnificados',
      'Polideportivo El Poliedro',
      'Universidad Metropolitana - Refugio temporal'
    );
  END IF;

  IF to_regclass('public.sources') IS NOT NULL THEN
    DELETE FROM sources
    WHERE name = 'Reporte Voluntario';
  END IF;
END $$;
