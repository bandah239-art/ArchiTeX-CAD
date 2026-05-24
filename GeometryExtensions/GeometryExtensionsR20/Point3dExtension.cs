using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;

using System;

namespace Gile.AutoCAD.R20.Geometry
{
    /// <summary>
    /// Provides extension methods for the Point2d type.
    /// </summary>
    public static class Point3dExtension
    {
        /// <summary>
        /// Converts a Point3d into a Point2d (projection on XY plane).
        /// </summary>
        /// <param name="pt">The instance to which this method applies.</param>
        /// <returns>The corresponding Point3d.</returns>
        public static Point2d Convert2d(this Point3d pt) =>
            new Point2d(pt.X, pt.Y);

        /// <summary>
        /// Projects the point on the WCS XY plane.
        /// </summary>
        /// <param name="pt">The point to be projected.</param>
        /// <returns>The projected point.</returns>
        public static Point3d Flatten(this Point3d pt) =>
            new Point3d(pt.X, pt.Y, 0.0);

        /// <summary>
        /// Gets a value indicating if <c>pt</c> lies on the segment <c>p1</c> <c>p2</c> using Tolerance.Global.
        /// </summary>
        /// <param name="pt">The instance to which this method applies.</param>
        /// <param name="p1">The start point of the segment.</param>
        /// <param name="p2">The end point of the segment.</param>
        /// <returns>true, if the point lies on the segment ; false, otherwise.</returns>
        public static bool IsBetween(this Point3d pt, Point3d p1, Point3d p2) =>
            p1.GetVectorTo(pt).GetNormal().Equals(pt.GetVectorTo(p2).GetNormal());

        /// <summary>
        /// Gets a value indicating if <c>pt</c> lies on the segment <c>p1</c> <c>p2</c> using the specified Tolerance.
        /// </summary>
        /// <param name="pt">The instance to which this method applies.</param>
        /// <param name="p1">The start point of the segment.</param>
        /// <param name="p2">The end point of the segment.</param>
        /// <param name="tol">The tolerance used for comparisons.</param>
        /// <returns>true, if the point lies on the segment ; false, otherwise.</returns>
        public static bool IsBetween(this Point3d pt, Point3d p1, Point3d p2, Tolerance tol) =>
            p1.GetVectorTo(pt).GetNormal(tol).Equals(pt.GetVectorTo(p2).GetNormal(tol));

        /// <summary>
        /// Get a value indicating if the specified point is inside the extents.
        /// </summary>
        /// <param name="pt">The instance to which this method applies.</param>
        /// <param name="extents">The extents 2d to test against.</param>
        /// <returns>true, if the point us inside the extents ; false, otherwise.</returns>
        public static bool IsInside(this Point3d pt, Extents3d extents) =>
            pt.X >= extents.MinPoint.X &&
            pt.Y >= extents.MinPoint.Y &&
            pt.Z >= extents.MinPoint.Z &&
            pt.X <= extents.MaxPoint.X &&
            pt.Y <= extents.MaxPoint.Y &&
            pt.Z <= extents.MaxPoint.Z;

        /// <summary>
        /// Defines a point with polar coordiantes relative to a base point.
        /// </summary>
        /// <param name="org">The instance to which this method applies.</param>
        /// <param name="angle">The angle in radians from the X axis.</param>
        /// <param name="distance">The distance from the base point.</param>
        /// <returns>The new point3d.</returns>
        public static Point3d Polar(this Point3d org, double angle, double distance) =>
            new Point3d(
                org.X + distance * Math.Cos(angle),
                org.Y + distance * Math.Sin(angle),
                org.Z);

        #region P/Invoke acedTrans
        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, int from, int to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, CoordSystem from, CoordSystem to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, int from, ObjectId to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, CoordSystem from, ObjectId to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, int from, Vector3d to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, from),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Coordinate system.</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, CoordSystem from, Vector3d to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Int16, (int)from),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, ObjectId from, int to) =>
            point.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, ObjectId from, CoordSystem to) =>
            point.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, ObjectId from, ObjectId to) =>
            point.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, ObjectId from, Vector3d to) =>
            point.Trans(
                new TypedValue((int)LispDataType.ObjectId, from),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Coordinate system code: 0 = WCS, 1 = UCS, 2 = DCS, 3 = PSDCS (used only with code 2).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, Vector3d from, int to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()),
                new TypedValue((int)LispDataType.Int16, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Coordinate system.</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, Vector3d from, CoordSystem to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()),
                new TypedValue((int)LispDataType.Int16, (int)to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">ObjectId of a planar entity (this specifies the ECS of the entity).</param>
        /// <returns>The translated point.</returns>
        public static Point3d Trans(this Point3d point, Vector3d from, ObjectId to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()),
                new TypedValue((int)LispDataType.ObjectId, to));

        /// <summary>
        /// Translates a point from one coordinate system into another.
        /// </summary>
        /// <param name="point">The instance to which the method applies.</param>
        /// <param name="from">Extrusion vector.</param>
        /// <param name="to">Extrusion vector.</param>
        /// <returns>The translated point.</returns>   
        public static Point3d Trans(this Point3d point, Vector3d from, Vector3d to) =>
            point.Trans(
                new TypedValue((int)LispDataType.Point3d, from.GetAsPoint()),
                new TypedValue((int)LispDataType.Point3d, to.GetAsPoint()));

        private static Point3d Trans(this Point3d point, TypedValue from, TypedValue to) =>
            new Point3d(GeometryExtension.Trans(point.ToArray(), from, to, 0));
        #endregion
    }
}
