using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;

namespace Gile.AutoCAD.R20.Geometry
{
    /// <summary>
    /// Provides extension methods for the Vector2d type.
    /// </summary>
    public static class Vector3dExtension
    {
        /// <summary>
        /// Projects the point on the WCS XY plane.
        /// </summary>
        /// <param name="vector">The instance to which this method applies.</param>
        /// <returns>The projected vector.</returns>
        public static Vector3d Flatten(this Vector3d vector) => new Vector3d(vector.X, vector.Y, 0.0);

        /// <summary>
        /// Converts 3D vector into 3D point with the same set of coordinates.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <returns>An instance of Point3D.</returns>
        public static Point3d GetAsPoint(this Vector3d vector) =>
            new Point3d(vector.X, vector.Y, vector.Z);

        #region Trans (P/Invoke acedTrans)
        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, int from, int to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, CoordSystem from, CoordSystem to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, int from, ObjectId to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, CoordSystem from, ObjectId to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, int from, Vector3d to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, CoordSystem from, Vector3d to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, ObjectId from, int to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, ObjectId from, CoordSystem to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, ObjectId from, ObjectId to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.ObjectId, from), 
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, ObjectId from, Vector3d to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.ObjectId, from), 
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, Vector3d from, int to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()), 
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, Vector3d from, CoordSystem to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Vector3d Trans(this Vector3d vector, Vector3d from, ObjectId to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()), 
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a vector from one coordinate system into another.
        /// </summary>
        /// <param name="vector">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>   
        public static Vector3d Trans(this Vector3d vector, Vector3d from, Vector3d to) =>
            vector.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()), 
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        private static Vector3d Trans(this Vector3d vector, TypedValue from, TypedValue to) =>
            new Vector3d(GeometryExtension.Trans(vector.ToArray(), from, to, 1));
        #endregion
    }
}
