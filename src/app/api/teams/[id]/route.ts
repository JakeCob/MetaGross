import {
  getTeamById,
  updateTeam,
  deleteTeam,
  setActiveTeam,
} from '@/lib/db/queries/teams';
import { validateTeam, teamPokemonSchema } from '@/lib/validation/team';
import { z } from 'zod';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const team = await getTeamById(id);

    if (!team) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    return Response.json({ team });
  } catch (error) {
    console.error('GET /api/teams/[id] error:', error);
    return Response.json(
      { error: 'Failed to fetch team' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // If a full team payload is provided (name+format+pokemon), validate as a
    // complete team. Otherwise, if only pokemon is provided, still validate the
    // pokemon array to prevent malformed data.
    if (body.pokemon && body.name && body.format) {
      const validation = validateTeam(body);
      if (!validation.success) {
        return Response.json(
          { error: 'Validation failed', details: validation.errors },
          { status: 400 },
        );
      }
    } else if (body.pokemon && Array.isArray(body.pokemon)) {
      const pokemonArraySchema = z
        .array(teamPokemonSchema)
        .min(1, 'At least 1 Pokemon required')
        .max(6, 'Maximum 6 Pokemon');
      const result = pokemonArraySchema.safeParse(body.pokemon);
      if (!result.success) {
        const errors = result.error.issues.map((i) => i.message);
        return Response.json(
          { error: 'Validation failed', details: errors },
          { status: 400 },
        );
      }
    }

    const updated = await updateTeam(id, {
      name: body.name,
      format: body.format,
      pokepaste: body.pokepaste,
      description: body.description,
      notes: body.notes,
      pokemon: body.pokemon,
    });

    if (!updated) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    return Response.json({ team: updated });
  } catch (error) {
    console.error('PUT /api/teams/[id] error:', error);
    return Response.json(
      { error: 'Failed to update team' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const deleted = await deleteTeam(id);

    if (!deleted) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/teams/[id] error:', error);
    return Response.json(
      { error: 'Failed to delete team' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Toggle is_active: if body has is_active === true, set this team active
    // (deactivating all others). If is_active === false, just deactivate it.
    if (body.isActive === true || body.is_active === true) {
      const team = await setActiveTeam(DEFAULT_USER_ID, id);

      if (!team) {
        return Response.json({ error: 'Team not found' }, { status: 404 });
      }

      return Response.json({ team });
    }

    // Deactivate this team specifically
    if (body.isActive === false || body.is_active === false) {
      const updated = await updateTeam(id, { isActive: 0 });

      if (!updated) {
        return Response.json({ error: 'Team not found' }, { status: 404 });
      }

      return Response.json({ team: updated });
    }

    return Response.json(
      { error: 'PATCH expects { isActive: boolean }' },
      { status: 400 },
    );
  } catch (error) {
    console.error('PATCH /api/teams/[id] error:', error);
    return Response.json(
      { error: 'Failed to update team status' },
      { status: 500 },
    );
  }
}
