from .core import create_app

# Import migrations before router so the migration LifespanDependency is registered.
# Its lifespan runs after lakebase's (which populates app.state.engine) because the
# lakebase dependency is imported/registered earlier via .core.
from . import migrations  # noqa: F401
from .campaigns import router as campaigns_router
from .campaign_audience import router as campaign_audience_router
from .genie import router as genie_router
from .insights import router as insights_router
from .router import router

app = create_app(
    routers=[
        router,
        genie_router,
        campaigns_router,
        campaign_audience_router,
        insights_router,
    ]
)
