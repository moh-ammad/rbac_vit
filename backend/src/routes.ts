import { Router } from "express";
import { authenticate } from "./middleware/auth.js";
import authRoutes from "./modules/auth/auth.routes.js";
import classesRoutes from "./modules/classes/classes.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import instructionsRoutes from "./modules/instructions/instructions.routes.js";
import papersRoutes from "./modules/papers/papers.routes.js";
import resourcesRoutes from "./modules/resources/resources.routes.js";
import rolesRoutes from "./modules/roles/roles.routes.js";
import schoolRoutes from "./modules/school/school.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import videosRoutes from "./modules/videos/videos.routes.js";

const router = Router();

// Public: register / login / logout (and /me, which authenticates itself).
router.use(authRoutes);

// Everything below needs a valid session cookie.
router.use(authenticate);
router.use(dashboardRoutes);
router.use(rolesRoutes);
router.use(usersRoutes);
router.use(classesRoutes);
router.use(resourcesRoutes);
router.use(videosRoutes);
router.use(papersRoutes);
router.use(instructionsRoutes);
router.use(schoolRoutes);
router.use(searchRoutes);

export default router;
