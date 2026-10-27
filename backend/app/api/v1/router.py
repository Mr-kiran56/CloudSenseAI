from fastapi import APIRouter
from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .costs import router as costs_router
from .forecasts import router as forecasts_router
from .unit_economics import router as unit_economics_router
from .anomalies import router as anomalies_router
from .resources import router as resources_router
from .recommendations import router as recommendations_router
from .approvals import router as approvals_router
from .remediations import router as remediations_router
from .simulations import router as simulations_router
from .chat import router as chat_router
from .audit import router as audit_router
from .notifications import router as notifications_router
from .integrations import router as integrations_router
from .accounts import router as accounts_router
from .synthesis import router as synthesis_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(costs_router)
api_router.include_router(forecasts_router)
api_router.include_router(unit_economics_router)
api_router.include_router(anomalies_router)
api_router.include_router(resources_router)
api_router.include_router(recommendations_router)
api_router.include_router(approvals_router)
api_router.include_router(remediations_router)
api_router.include_router(simulations_router)
api_router.include_router(chat_router)
api_router.include_router(audit_router)
api_router.include_router(notifications_router)
api_router.include_router(integrations_router)
api_router.include_router(accounts_router)
api_router.include_router(synthesis_router)
