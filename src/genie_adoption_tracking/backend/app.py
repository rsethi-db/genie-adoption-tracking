from .core import create_app

# Import migrations before router so the migration LifespanDependency is registered.
# Its lifespan runs after lakebase's (which populates app.state.engine) because the
# lakebase dependency is imported/registered earlier via .core.
from . import migrations  # noqa: F401
from .router import router

app = create_app(routers=[router])
